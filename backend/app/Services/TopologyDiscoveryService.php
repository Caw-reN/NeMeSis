<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DeviceLog;
use App\Models\TopologyLink;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * TopologyDiscoveryService
 *
 * Fase 4: Auto-Discovery via CDP/LLDP (Cisco) and /ip/neighbor (Mikrotik).
 *
 * Algorithm:
 * 1. Iterate all active devices that have credentials (mikrotik or cisco).
 * 2. Pull neighbor table from each device.
 * 3. For each neighbor found, check if its IP or hostname matches a known Device in DB.
 * 4. If match found → updateOrCreate a TopologyLink (physical).
 * 5. Return summary of what was discovered.
 *
 * SAFETY: Only creates/updates links; never deletes existing manual links.
 */
class TopologyDiscoveryService
{
    /** Neighbor data shape: [ip, hostname, local_iface, remote_iface, protocol] */
    private array $discovered = [];

    /** Counters for the summary report */
    private int $linksCreated = 0;
    private int $linksUpdated = 0;
    private int $errors       = 0;

    public function __construct(
        private readonly DeviceCredentialService $credService,
    ) {}

    // =========================================================================
    // Public Entry Point
    // =========================================================================

    /**
     * Run full auto-discovery across all eligible active devices.
     *
     * @param  int|null  $deviceId  If provided, only scan this device.
     * @return array{
     *   scanned: int,
     *   neighbors_found: int,
     *   links_created: int,
     *   links_updated: int,
     *   errors: int,
     *   details: array
     * }
     */
    public function run(?int $deviceId = null): array
    {
        $this->discovered   = [];
        $this->linksCreated = 0;
        $this->linksUpdated = 0;
        $this->errors       = 0;

        // Load candidate devices
        $query = Device::active();
        if ($deviceId) {
            $query->where('id', $deviceId);
        }

        $devices = $query->get()->filter(fn (Device $d) =>
            in_array($d->vendor, ['mikrotik', 'cisco']) && !empty($d->credentials)
        );

        $scanned = 0;

        foreach ($devices as $device) {
            try {
                $neighbors = $this->pullNeighbors($device);
                $this->processNeighbors($device, $neighbors);
                $scanned++;
            } catch (\Throwable $e) {
                $this->errors++;
                Log::warning("TopologyDiscovery: failed on device {$device->name} ({$device->ip_address}): {$e->getMessage()}");
            }
        }

        return [
            'scanned'        => $scanned,
            'neighbors_found'=> count($this->discovered),
            'links_created'  => $this->linksCreated,
            'links_updated'  => $this->linksUpdated,
            'errors'         => $this->errors,
            'details'        => $this->discovered,
        ];
    }

    // =========================================================================
    // Step 1: Pull neighbors from device
    // =========================================================================

    /**
     * Pull raw neighbor data from device (Mikrotik or Cisco).
     *
     * @return array<int, array{ip: string, hostname: string, local_iface: string, remote_iface: string, protocol: string}>
     */
    private function pullNeighbors(Device $device): array
    {
        return match ($device->vendor) {
            'mikrotik' => $this->pullMikrotikNeighbors($device),
            'cisco'    => $this->pullCiscoNeighbors($device),
            default    => [],
        };
    }

    private function pullMikrotikNeighbors(Device $device): array
    {
        $creds = $this->credService->getMikrotikCredentials($device);
        if (!$creds) {
            return [];
        }

        $service = new MikrotikService($device->ip_address, $creds['api_port']);
        $service->connect($creds['api_user'], $creds['api_pass']);

        try {
            $rows = $service->getNeighbors();
        } finally {
            $service->disconnect();
        }

        return array_map(fn (array $row) => [
            'ip'           => $row['address']        ?? $row['address4']   ?? '',
            'hostname'     => $row['identity']        ?? $row['system-name'] ?? '',
            'local_iface'  => $row['interface']       ?? '',
            'remote_iface' => $row['interface-name']  ?? '',
            'protocol'     => 'lldp',
        ], $rows);
    }

    private function pullCiscoNeighbors(Device $device): array
    {
        $creds = $this->credService->getCiscoCredentials($device);
        if (!$creds) {
            return [];
        }

        $service = new CiscoSshService($device->ip_address, $creds['ssh_port']);
        $service->connect($creds['ssh_user'], $creds['ssh_pass'], $creds['enable_pass']);

        try {
            // Prefer CDP; fall back to LLDP if CDP returns nothing
            $neighbors = $service->getCdpNeighbors();
            if (empty($neighbors)) {
                $neighbors = $service->getLldpNeighbors();
            }
        } finally {
            $service->disconnect();
        }

        return $neighbors;
    }

    // =========================================================================
    // Step 2: Match neighbors to DB devices → create/update links
    // =========================================================================

    /**
     * For each neighbor, find a matching Device in DB and upsert the link.
     */
    private function processNeighbors(Device $sourceDevice, array $neighbors): void
    {
        // Cache the full device list (by IP and by normalized hostname)
        static $allDevices = null;
        if ($allDevices === null) {
            $allDevices = Device::active()->get();
        }

        foreach ($neighbors as $neighbor) {
            $ip       = trim($neighbor['ip']       ?? '');
            $hostname = trim($neighbor['hostname']  ?? '');

            if (!$ip && !$hostname) {
                continue;
            }

            // Try to match by IP first, then by hostname (case-insensitive, ignoring domain suffix)
            $targetDevice = $this->findDevice($allDevices, $ip, $hostname);

            // Auto-discover new devices without credentials (like The Dude)
            if (!$targetDevice && $ip) {
                $targetDevice = Device::firstOrCreate(
                    ['ip_address' => $ip],
                    [
                        'name'        => $hostname ?: $ip,
                        'vendor'      => 'generic',
                        'type'        => 'other',
                        'status'      => 'unknown',
                        'is_active'   => true,
                        'description' => 'Auto-discovered via ' . strtoupper($neighbor['protocol'] ?? 'CDP/LLDP'),
                    ]
                );
                
                if (!$allDevices->contains('id', $targetDevice->id)) {
                    $allDevices->push($targetDevice);
                }
            }

            $entry = [
                'source_device'  => $sourceDevice->name,
                'source_ip'      => $sourceDevice->ip_address,
                'neighbor_ip'    => $ip,
                'neighbor_name'  => $hostname,
                'local_iface'    => $neighbor['local_iface']  ?? '',
                'remote_iface'   => $neighbor['remote_iface'] ?? '',
                'protocol'       => $neighbor['protocol']     ?? 'cdp',
                'matched'        => $targetDevice !== null,
                'link_created'   => false,
            ];

            if ($targetDevice && $targetDevice->id !== $sourceDevice->id) {
                $wasCreated = $this->upsertLink($sourceDevice, $targetDevice, $neighbor);
                $entry['link_created'] = true;
                $entry['target_device'] = $targetDevice->name;

                if ($wasCreated) {
                    $this->linksCreated++;
                } else {
                    $this->linksUpdated++;
                }
            }

            $this->discovered[] = $entry;
        }

        // Reset static cache for next call (in case tests/re-runs)
        $allDevices = null;
    }

    /**
     * Find a Device by IP address or by hostname (partial match, ignore domain).
     */
    private function findDevice(Collection $devices, string $ip, string $hostname): ?Device
    {
        // Normalize hostname: take only the short name (strip domain suffix)
        $shortName = strtolower(explode('.', $hostname)[0]);

        return $devices->first(function (Device $d) use ($ip, $shortName) {
            // Exact IP match
            if ($ip && $d->ip_address === $ip) {
                return true;
            }

            // Case-insensitive hostname match (short name only)
            if ($shortName && str_starts_with(strtolower($d->name), $shortName)) {
                return true;
            }

            return false;
        });
    }

    /**
     * UpdateOrCreate a physical topology link between two devices.
     *
     * Returns true if a NEW link was created, false if an existing one was updated.
     */
    private function upsertLink(Device $source, Device $target, array $neighbor): bool
    {
        // Normalize direction: always store with smaller ID as source to prevent duplicate edges
        // (A→B and B→A would both be found via neighbors; we want only one DB record)
        [$srcId, $tgtId] = $source->id < $target->id
            ? [$source->id, $target->id]
            : [$target->id, $source->id];

        [$srcIface, $tgtIface] = $source->id < $target->id
            ? [$neighbor['local_iface'] ?? null, $neighbor['remote_iface'] ?? null]
            : [$neighbor['remote_iface'] ?? null, $neighbor['local_iface'] ?? null];

        $protocol = strtoupper($neighbor['protocol'] ?? 'CDP');

        $existing = TopologyLink::where('source_device_id', $srcId)
            ->where('target_device_id', $tgtId)
            ->first();

        TopologyLink::updateOrCreate(
            [
                'source_device_id' => $srcId,
                'target_device_id' => $tgtId,
            ],
            [
                'link_type'        => 'physical',
                'label'            => $srcIface ? "{$srcIface} ↔ {$tgtIface}" : $protocol,
                'source_interface' => $srcIface,
                'target_interface' => $tgtIface,
                'is_active'        => true,
            ]
        );

        return $existing === null; // true = newly created
    }
}
