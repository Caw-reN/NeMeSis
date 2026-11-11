<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceLog;
use App\Models\Setting;
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
        $scannableDevices = Device::whereNotNull('ip_address')->where('ip_address', '!=', '')->count();
        $upDevices       = Device::up()->count();
        $downDevices     = Device::down()->count();
        $unknownDevices  = Device::where('status', 'unknown')
                                 ->whereNotNull('ip_address')
                                 ->where('ip_address', '!=', '')
                                 ->count();
        $snmpDevices     = Device::snmpEnabled()->count();

        // Last scan time = most recent last_seen_at across all devices
        $lastScanAt = Device::whereNotNull('last_seen_at')
            ->max('last_seen_at');

        // Recent critical events (DOWN status changes and Queue overload alerts in last 24h)
        $recentAlerts = DeviceLog::whereIn('event_type', ['status_change', 'error'])
            ->where('created_at', '>=', now()->subDay())
            ->where(function ($q) {
                $q->whereJsonContains('metadata->after', 'down')
                  ->orWhereJsonContains('metadata->type', 'simple_queue')
                  ->orWhereJsonContains('metadata->type', 'queue_tree');
            })
            ->with('device:id,name,ip_address')
            ->latest()
            ->take(6)
            ->get()
            ->map(fn ($log) => [
                'device_name' => $log->device?->name,
                'ip_address'  => $log->device?->ip_address,
                'message'     => $log->message,
                'is_queue'    => in_array($log->metadata['type'] ?? '', ['simple_queue', 'queue_tree']),
                'time'        => $log->created_at->diffForHumans(),
            ]);

        $devicesByType = Device::with('deviceType')
            ->selectRaw('type, count(*) as count')
            ->groupBy('type')
            ->get()
            ->map(function ($item) {
                return [
                    'type'  => $item->type,
                    'label' => $item->deviceType?->label ?? ucfirst($item->type ?: 'unknown'),
                    'count' => $item->count,
                    'icon_svg' => $item->deviceType?->icon_svg,
                ];
            });

        $internet = [
            'status'      => Setting::where('key', 'internet_status')->value('value') ?? 'unknown',
            'latency_ms'  => (float)(Setting::where('key', 'internet_latency')->value('value') ?? 0),
            'packet_loss' => (float)(Setting::where('key', 'internet_packet_loss')->value('value') ?? 0),
            'target'      => Setting::where('key', 'internet_target')->value('value') ?? '8.8.8.8',
            'checked_at'  => Setting::where('key', 'internet_checked_at')->value('value'),
        ];

        return response()->json([
            'summary' => [
                'total_devices'   => $totalDevices,
                'up_devices'      => $upDevices,
                'down_devices'    => $downDevices,
                'unknown_devices' => $unknownDevices,
                'snmp_devices'    => $snmpDevices,
                'uptime_percent'  => $scannableDevices > 0
                    ? round(($upDevices / $scannableDevices) * 100, 1)
                    : 0,
                'last_scan_at'    => $lastScanAt,
                'internet'        => $internet,
            ],
            'internet'        => $internet,
            'recent_alerts'   => $recentAlerts,
            'devices_by_type' => $devicesByType,
        ]);
    }
}
