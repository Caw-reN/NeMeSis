<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceLog;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * GET /api/dashboard/summary
     * Returns high-level KPI stats for the dashboard header cards.
     */
    public function summary(): JsonResponse
    {
        $totalDevices    = Device::count();
        $upDevices       = Device::up()->count();
        $downDevices     = Device::down()->count();
        $unknownDevices  = Device::where('status', 'unknown')->count();
        $snmpDevices     = Device::snmpEnabled()->count();

        // Last scan time = most recent last_seen_at across all devices
        $lastScanAt = Device::whereNotNull('last_seen_at')
            ->max('last_seen_at');

        // Recent critical events (DOWN status changes in last 24h)
        $recentAlerts = DeviceLog::where('event_type', 'status_change')
            ->where('created_at', '>=', now()->subDay())
            ->whereJsonContains('metadata->after', 'down')
            ->with('device:id,name,ip_address')
            ->latest()
            ->take(5)
            ->get()
            ->map(fn ($log) => [
                'device_name' => $log->device?->name,
                'ip_address'  => $log->device?->ip_address,
                'message'     => $log->message,
                'time'        => $log->created_at->diffForHumans(),
            ]);

        return response()->json([
            'summary' => [
                'total_devices'   => $totalDevices,
                'up_devices'      => $upDevices,
                'down_devices'    => $downDevices,
                'unknown_devices' => $unknownDevices,
                'snmp_devices'    => $snmpDevices,
                'uptime_percent'  => $totalDevices > 0
                    ? round(($upDevices / $totalDevices) * 100, 1)
                    : 0,
                'last_scan_at'    => $lastScanAt,
            ],
            'recent_alerts' => $recentAlerts,
        ]);
    }
}
