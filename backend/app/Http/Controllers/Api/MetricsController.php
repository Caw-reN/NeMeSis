<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Services\CiscoSshService;
use App\Services\DeviceCredentialService;
use App\Services\MikrotikService;
use Illuminate\Http\JsonResponse;

/**
 * MetricsController — Fase 3a (Read Mode)
 *
 * Provides real-time metric endpoints for Mikrotik and Cisco devices.
 * All operations are read-only; write operations are reserved for Fase 3b.
 *
 * Endpoints:
 *   GET /api/devices/{device}/metrics/mikrotik
 *   GET /api/devices/{device}/metrics/cisco
 */
class MetricsController extends Controller
{
    public function __construct(
        private readonly DeviceCredentialService $credService,
    ) {}

    // =========================================================================
    // Mikrotik
    // =========================================================================

    /**
     * GET /api/devices/{device}/metrics/mikrotik
     *
     * Returns: system resources, interfaces (with Rx/Tx), IP addresses, DHCP leases.
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

            $data = [
                'vendor'           => 'mikrotik',
                'device_name'      => $device->name,
                'ip_address'       => $device->ip_address,
                'system_resources' => $service->getSystemResources(),
                'interfaces'       => $service->getInterfaces(),
                'ip_addresses'     => $service->getIpAddresses(),
                'dhcp_leases'      => $service->getDhcpLeases(),
                'routing_table'    => $service->getRoutingTable(),
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
