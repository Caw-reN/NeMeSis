<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Services\CiscoSshService;
use App\Services\DeviceCredentialService;
use App\Services\MikrotikQueueService;
use App\Services\MikrotikService;
use Illuminate\Http\JsonResponse;

/**
 * MetricsController — Fase 3a (Read Mode) & Queue Monitoring
 *
 * Provides real-time metric endpoints for Mikrotik and Cisco devices.
 * All operations are read-only; write operations are reserved for Fase 3b.
 *
 * Endpoints:
 *   GET /api/devices/{device}/metrics/mikrotik
 *   GET /api/devices/{device}/metrics/mikrotik/queues
 *   GET /api/devices/{device}/metrics/cisco
 */
class MetricsController extends Controller
{
    public function __construct(
        private readonly DeviceCredentialService $credService,
        private readonly MikrotikQueueService    $queueService,
    ) {}

    // =========================================================================
    // Mikrotik
    // =========================================================================

    /**
     * GET /api/devices/{device}/metrics/mikrotik
     *
     * Returns: system resources, interfaces (with Rx/Tx), IP addresses, DHCP leases,
     *          routing table, and parsed bandwidth queues.
     */
    public function mikrotik(Device $device): JsonResponse
    {
        if (!$device->is_active) {
            return response()->json(['error' => 'Device is marked as inactive.'], 400);
        }

        if ($device->vendor !== 'mikrotik') {
            return response()->json([
                'error' => "This endpoint is for Mikrotik devices only. Current vendor: '{$device->vendor}'.",
            ], 400);
        }

        $creds = $this->credService->getMikrotikCredentials($device);

        if (!$creds) {
            return response()->json([
                'error'  => 'Mikrotik API credentials not configured.',
                'action' => 'Edit this device and fill in the Mikrotik API username and password.',
            ], 422);
        }

        $service = new MikrotikService($device->ip_address, $creds['api_port']);

        try {
            $service->connect($creds['api_user'], $creds['api_pass']);

            $threshold = $this->queueService->getThreshold();
            $rawSimple = $service->getSimpleQueues();
            $rawTrees  = $service->getQueueTrees();

            $simpleQueues = $this->queueService->parseSimpleQueues($rawSimple, $threshold);
            $queueTrees   = $this->queueService->parseQueueTrees($rawTrees, $threshold);

            // Evaluate alerts and send Telegram notification if needed
            $alertStats = $this->queueService->checkAndNotify($device, $simpleQueues, $queueTrees, $threshold);

            // Compute summary
            $overloadedCount = count(array_filter($simpleQueues, fn($q) => $q['is_overloaded']))
                             + count(array_filter($queueTrees, fn($t) => $t['is_overloaded']));

            $data = [
                'vendor'           => 'mikrotik',
                'device_name'      => $device->name,
                'ip_address'       => $device->ip_address,
                'system_resources' => $service->getSystemResources(),
                'interfaces'       => $service->getInterfaces(),
                'ip_addresses'     => $service->getIpAddresses(),
                'dhcp_leases'      => $service->getDhcpLeases(),
                'routing_table'    => $service->getRoutingTable(),
                'queues'           => [
                    'threshold_percent' => $threshold,
                    'simple_queues'     => $simpleQueues,
                    'queue_trees'       => $queueTrees,
                    'overloaded_count'  => $overloadedCount,
                    'has_overloaded'    => $overloadedCount > 0,
                    'alert_stats'       => $alertStats,
                ],
                'polled_at'        => now()->toIso8601String(),
            ];

            $service->disconnect();

            return response()->json($data);
        } catch (\Throwable $e) {
            $service->disconnect();

            return response()->json([
                'error'   => 'Failed to retrieve metrics from Mikrotik device.',
                'details' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * GET /api/devices/{device}/metrics/mikrotik/queues
     *
     * Targeted endpoint to fetch only queues for high-frequency polling.
     */
    public function mikrotikQueues(Device $device): JsonResponse
    {
        if (!$device->is_active) {
            return response()->json(['error' => 'Device is marked as inactive.'], 400);
        }

        if ($device->vendor !== 'mikrotik') {
            return response()->json([
                'error' => "This endpoint is for Mikrotik devices only. Current vendor: '{$device->vendor}'.",
            ], 400);
        }

        $creds = $this->credService->getMikrotikCredentials($device);
        if (!$creds) {
            return response()->json(['error' => 'Mikrotik credentials not configured.'], 422);
        }

        $service = new MikrotikService($device->ip_address, $creds['api_port']);

        try {
            $service->connect($creds['api_user'], $creds['api_pass']);

            $threshold    = $this->queueService->getThreshold();
            $simpleQueues = $this->queueService->parseSimpleQueues($service->getSimpleQueues(), $threshold);
            $queueTrees   = $this->queueService->parseQueueTrees($service->getQueueTrees(), $threshold);

            $alertStats = $this->queueService->checkAndNotify($device, $simpleQueues, $queueTrees, $threshold);

            $overloadedCount = count(array_filter($simpleQueues, fn($q) => $q['is_overloaded']))
                             + count(array_filter($queueTrees, fn($t) => $t['is_overloaded']));

            $service->disconnect();

            return response()->json([
                'device_id'         => $device->id,
                'device_name'       => $device->name,
                'threshold_percent' => $threshold,
                'simple_queues'     => $simpleQueues,
                'queue_trees'       => $queueTrees,
                'overloaded_count'  => $overloadedCount,
                'has_overloaded'    => $overloadedCount > 0,
                'alert_stats'       => $alertStats,
                'polled_at'         => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            $service->disconnect();
            return response()->json([
                'error'   => 'Failed to retrieve queues from Mikrotik device.',
                'details' => $e->getMessage(),
            ], 503);
        }
    }

    /**
     * Check all active MikroTik devices for queue overloads (called by worker or scheduler).
     */
    public function checkAllQueuesAlerts(): JsonResponse
    {
        $devices = Device::where('is_active', true)
            ->where('vendor', 'mikrotik')
            ->get();

        $results = [];
        $totalAlerts = 0;
        $totalRecoveries = 0;
        $threshold = $this->queueService->getThreshold();

        foreach ($devices as $device) {
            $creds = $this->credService->getMikrotikCredentials($device);
            if (!$creds) {
                continue;
            }

            $service = new MikrotikService($device->ip_address, $creds['api_port']);
            try {
                $service->connect($creds['api_user'], $creds['api_pass']);
                $simpleQueues = $this->queueService->parseSimpleQueues($service->getSimpleQueues(), $threshold);
                $queueTrees   = $this->queueService->parseQueueTrees($service->getQueueTrees(), $threshold);
                $service->disconnect();

                $stats = $this->queueService->checkAndNotify($device, $simpleQueues, $queueTrees, $threshold);
                $totalAlerts += $stats['alerts'];
                $totalRecoveries += $stats['recoveries'];

                $results[] = [
                    'device_id'   => $device->id,
                    'device_name' => $device->name,
                    'status'      => 'ok',
                    'stats'       => $stats,
                ];
            } catch (\Throwable $e) {
                $service->disconnect();
                $results[] = [
                    'device_id'   => $device->id,
                    'device_name' => $device->name,
                    'status'      => 'error',
                    'message'     => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'total_devices_checked' => count($devices),
            'total_alerts'          => $totalAlerts,
            'total_recoveries'      => $totalRecoveries,
            'threshold_percent'     => $threshold,
            'results'               => $results,
            'timestamp'             => now()->toIso8601String(),
        ]);
    }

    // =========================================================================
    // Cisco
    // =========================================================================

    /**
     * GET /api/devices/{device}/metrics/cisco
     *
     * Returns: version info, interface status table, interface detail counters,
     *          VLAN table, MAC address table.
     */
    public function cisco(Device $device): JsonResponse
    {
        if (!$device->is_active) {
            return response()->json(['error' => 'Device is marked as inactive.'], 400);
        }

        if ($device->vendor !== 'cisco') {
            return response()->json([
                'error' => "This endpoint is for Cisco devices only. Current vendor: '{$device->vendor}'.",
            ], 400);
        }

        $creds = $this->credService->getCiscoCredentials($device);

        if (!$creds) {
            return response()->json([
                'error'  => 'Cisco SSH credentials not configured.',
                'action' => 'Edit this device and fill in SSH username, password, and enable password.',
            ], 422);
        }

        $service = new CiscoSshService($device->ip_address, $creds['ssh_port'], 5);

        try {
            $service->connect($creds['ssh_user'], $creds['ssh_pass'], $creds['enable_pass']);

            $data = [
                'vendor'             => 'cisco',
                'device_name'        => $device->name,
                'ip_address'         => $device->ip_address,
                'version'            => $service->getVersion(),
                'interface_status'   => $service->getInterfaceStatus(),
                'interface_detail'   => $service->getInterfaceDetail(),
                'vlan_brief'         => $service->getVlanBrief(),
                'mac_address_table'  => $service->getMacAddressTable(),
                'polled_at'          => now()->toIso8601String(),
            ];

            $service->disconnect();

            return response()->json($data);
        } catch (\Throwable $e) {
            $service->disconnect();

            return response()->json([
                'error'   => 'Failed to retrieve metrics from Cisco device.',
                'details' => $e->getMessage(),
            ], 503);
        }
    }
}
