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

    /** IP ranges filter (CIDR / range / single) — empty = no filter */
    private array $ipRanges = [];

    /**
     * Device type filter — empty = no filter.
     * Supported values: 'ap' (Access Points only)
     */
    private string $filterType = '';

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
    public function run(?int $deviceId = null, array $ipRanges = [], string $filterType = ''): array
    {
        $this->discovered   = [];
        $this->linksCreated = 0;
        $this->linksUpdated = 0;
        $this->errors       = 0;
        $this->ipRanges     = $ipRanges;
        $this->filterType   = $filterType;

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
            // Optimization: If user specified an IP range filter, skip scanning Cisco switches 
            // since they only act as L2 distribution and don't hold the ARP/DHCP endpoint tables.
            if (!empty($this->ipRanges) && $device->vendor === 'cisco') {
                continue;
            }

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
            // --- Source 1: DHCP Leases ---
            // Best source of truth: has hostnames and is always populated if MikroTik acts as DHCP server.
            $leases = $service->getDhcpLeases();

            // --- Source 2: ARP Table ---
            // Catches devices with static IPs that never appear in DHCP leases.
            $arp = $service->getArpTable();
        } finally {
            $service->disconnect();
        }

        // Build a map keyed by IP to merge and deduplicate both sources.
        // DHCP lease data takes priority (has hostname), ARP fills in the rest.
        $byIp = [];

        // Add ARP entries first (lower priority)
        foreach ($arp as $row) {
            $ip  = trim($row['address'] ?? '');
            $mac = trim($row['mac-address'] ?? '');

            // Skip incomplete/dynamic-only entries with no IP
            if (!$ip || $ip === '0.0.0.0') continue;
            // Skip the MikroTik's own IP to avoid self-referencing
            if ($ip === $device->ip_address) continue;

            $byIp[$ip] = [
                'ip'          => $ip,
                'hostname'    => '',   // ARP doesn't have hostnames
                'mac'         => $mac,
                'local_iface' => $row['interface'] ?? '',
                'source'      => 'arp',
            ];
        }

        // Overlay DHCP lease data (higher priority — overwrites ARP if same IP)
        foreach ($leases as $row) {
            // Use active-address if available, fall back to address
            $ip       = trim($row['active-address'] ?? $row['address'] ?? '');
            $hostname = trim($row['host-name'] ?? $row['client-id'] ?? '');
            $mac      = trim($row['mac-address'] ?? '');

            if (!$ip || $ip === '0.0.0.0') continue;
            if ($ip === $device->ip_address) continue;

            $byIp[$ip] = [
                'ip'          => $ip,
                'hostname'    => $hostname,
                'mac'         => $mac,
                'local_iface' => '',   // DHCP leases don't expose interface info
                'source'      => 'dhcp',
            ];
        }

        // Map to the standard neighbor format expected by processNeighbors()
        $neighbors = array_values(array_map(fn (array $entry) => [
            'ip'           => $entry['ip'],
            'hostname'     => $entry['hostname'],
            'local_iface'  => $entry['local_iface'],
            'remote_iface' => '',
            'protocol'     => $entry['source'], // 'arp' or 'dhcp'
        ], $byIp));

        // Apply IP range filter if specified
        if (!empty($this->ipRanges)) {
            $neighbors = array_values(array_filter(
                $neighbors,
                fn ($n) => $this->ipInRanges($n['ip'], $this->ipRanges)
            ));
        }

        // Apply device type filter if specified
        if ($this->filterType === 'ap') {
            $neighbors = array_values(array_filter(
                $neighbors,
                fn ($n) => $this->isAccessPoint($n['hostname'])
            ));
        }

        return $neighbors;
    }

    private function pullCiscoNeighbors(Device $device): array
    {
        $creds = $this->credService->getCiscoCredentials($device);
        if (!$creds) {
            return [];
        }

        $service = new CiscoSshService($device->ip_address, $creds['ssh_port'], 3);
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
    // IP Range & Device Type Filtering Helpers
    // =========================================================================

    /**
     * Detect if a hostname belongs to an Access Point device.
     *
     * Covers common AP vendors and naming conventions:
     *   - TP-Link EAP series (EAP110, EAP225, EAP245, etc.)
     *   - Ubiquiti UniFi (UAP-AC-PRO, U7Pro, etc.)
     *   - MikroTik CAP (cAP, wAP, OmniTIK, etc.)
     *   - Cisco AP (AIR-, AP-xxx)
     *   - Huawei AP (AP4xxx, AP6xxx)
     *   - Generic patterns
     */
    private function isAccessPoint(string $hostname): bool
    {
        if (empty($hostname)) return false;

        $h = strtolower($hostname);

        // TP-Link EAP series
        if (str_starts_with($h, 'eap')) return true;

        // Ubiquiti UniFi AP: UAP-*, U6-*, U7-*, UniFi-*
        if (str_starts_with($h, 'uap')) return true;
        if (str_starts_with($h, 'u6-') || str_starts_with($h, 'u7-')) return true;
        if (str_contains($h, 'unifi')) return true;

        // MikroTik CAP / wAP / OmniTIK / nanostation
        if (str_starts_with($h, 'cap')) return true;
        if (str_starts_with($h, 'wap')) return true;
        if (str_contains($h, 'omnitik')) return true;
        if (str_contains($h, 'nanostation')) return true;
        if (str_contains($h, 'nanohd')) return true;

        // Cisco AP (AIR-xxxxxx, AP-xxx)
        if (str_starts_with($h, 'air-')) return true;

        // Huawei AP
        if (preg_match('/^ap[46]\d{3}/i', $hostname)) return true;

        // Generic: hostname contains 'ap' as a standalone word/prefix
        if (preg_match('/\bap[-_]\w+|\bap\d+/i', $hostname)) return true;

        // Keywords
        if (str_contains($h, 'access-point') || str_contains($h, 'accesspoint')) return true;
        if (str_contains($h, 'wifi-ap') || str_contains($h, 'wlan-ap')) return true;

        return false;
    }

    /**
     * Check if an IP address is within any of the given ranges.
     *
     * Supported formats:
     *   - CIDR:  192.168.1.0/24
     *   - Range: 192.168.1.1-192.168.1.254
     *   - Single: 192.168.1.50
     */
    private function ipInRanges(string $ip, array $ranges): bool
    {
        if (empty($ranges)) return true;
        if (!filter_var($ip, FILTER_VALIDATE_IP)) return false;

        $ipLong = ip2long($ip);

        foreach ($ranges as $range) {
            $range = trim($range);

            if (str_contains($range, '/')) {
                // CIDR notation
                [$subnet, $bits] = explode('/', $range, 2);
                $bits = (int)$bits;
                $subnetLong = ip2long($subnet);
                $mask = $bits === 0 ? 0 : (~0 << (32 - $bits));
                if (($ipLong & $mask) === ($subnetLong & $mask)) {
                    return true;
                }
            } elseif (str_contains($range, '-')) {
                // Range notation: start-end
                [$start, $end] = explode('-', $range, 2);
                $startLong = ip2long(trim($start));
                $endLong   = ip2long(trim($end));
                if ($startLong !== false && $endLong !== false && $ipLong >= $startLong && $ipLong <= $endLong) {
                    return true;
                }
            } else {
                // Single IP
                if (ip2long($range) === $ipLong) {
                    return true;
                }
            }
        }

        return false;
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
