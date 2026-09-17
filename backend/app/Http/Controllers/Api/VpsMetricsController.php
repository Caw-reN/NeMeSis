<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * VpsMetricsController
 *
 * Returns the latest SNMP-collected metrics for a Linux/VPS server device.
 * Data is polled and stored by the Go worker; this controller only reads from DB.
 *
 * GET /api/devices/{device}/metrics/vps
 */
class VpsMetricsController extends Controller
{
    /**
     * Return the latest VPS metrics for a given device.
     */
    public function show(Device $device): JsonResponse
    {
        if ($device->vendor !== 'server') {
            return response()->json([
                'error' => "This endpoint is for Server/VPS devices only. Current vendor: '{$device->vendor}'.",
            ], 400);
        }

        if (!$device->is_active) {
            return response()->json(['error' => 'Device is marked as inactive.'], 400);
        }

        $row = DB::table('vps_metrics')
            ->where('device_id', $device->id)
            ->orderByDesc('polled_at')
            ->first();

        if (!$row) {
            return response()->json([
                'error' => 'No metrics available yet.',
                'hint' => 'Make sure the device has SNMP enabled and snmpd is running on the server. The worker polls every 60 seconds.',
            ], 404);
        }

        // Parse JSON columns
        $diskPartitions = json_decode($row->disk_partitions, true) ?? [];
        $netInterfaces = json_decode($row->net_interfaces, true) ?? [];

        // mem_free_kb  = available RAM (from hrStorage: total-used, or UCD-MIB memFree)
        // mem_cached_kb = Buffers+Cached from UCD-MIB, or 0 if hrStorage was used
        // used = total - free - cached
        $memUsedKB = $row->mem_total_kb - $row->mem_free_kb - $row->mem_cached_kb;
        $memUsedKB = max(0, $memUsedKB); // guard against edge cases
        $memUsedPct = $row->mem_total_kb > 0
            ? round(($memUsedKB / $row->mem_total_kb) * 100, 1)
            : 0;
        $cpuUsedPct = round(100 - ($row->cpu_idle ?? 0), 1);

        // Format uptime
        $uptimeSec = (int) $row->uptime_sec;
        $uptimeDays = intdiv($uptimeSec, 86400);
        $uptimeHours = intdiv($uptimeSec % 86400, 3600);
        $uptimeMins = intdiv($uptimeSec % 3600, 60);

        // Fetch 24-hour history
        $historyRaw = DB::table('vps_metrics')
            ->where('device_id', $device->id)
            ->where('polled_at', '>=', now()->subHours(24))
            ->orderBy('polled_at', 'asc')
            ->get(['polled_at', 'cpu_idle', 'mem_total_kb', 'mem_free_kb', 'mem_cached_kb', 'net_interfaces']);

        $history = [];
        $count = $historyRaw->count();
        $step = ceil($count / 100); // Target ~100 data points for a clean chart
        if ($step < 1)
            $step = 1;

        $prevTime = null;
        $prevNet = null;
        $lastFormattedTime = null;

        foreach ($historyRaw as $i => $hRow) {
            // Keep the first point, the last point, and every Nth point
            if ($i % $step !== 0 && $i !== $count - 1)
                continue;

            $formattedTime = \Carbon\Carbon::parse($hRow->polled_at, 'UTC')->setTimezone('Asia/Jakarta')->format('H:i');

            // Skip if we already have a data point for this exact minute (unless it's the very last point)
            if ($formattedTime === $lastFormattedTime && $i !== $count - 1) {
                continue;
            }
            $lastFormattedTime = $formattedTime;

            $hMemUsedKB = $hRow->mem_total_kb - $hRow->mem_free_kb - $hRow->mem_cached_kb;
            $hMemUsedKB = max(0, $hMemUsedKB);
            $hMemUsedPct = $hRow->mem_total_kb > 0 ? round(($hMemUsedKB / $hRow->mem_total_kb) * 100, 1) : 0;

            $currTime = strtotime($hRow->polled_at);
            $currNet = json_decode($hRow->net_interfaces, true) ?? [];
            $rxMbps = 0;
            $txMbps = 0;

            if ($prevNet !== null && $prevTime !== null) {
                $timeDiff = max(1, $currTime - $prevTime);
                $rxDiff = 0;
                $txDiff = 0;

                foreach ($currNet as $cIf) {
                    foreach ($prevNet as $pIf) {
                        if ($cIf['name'] === $pIf['name']) {
                            $rxd = $cIf['rx_bytes'] - $pIf['rx_bytes'];
                            $txd = $cIf['tx_bytes'] - $pIf['tx_bytes'];
                            if ($rxd >= 0)
                                $rxDiff += $rxd;
                            if ($txd >= 0)
                                $txDiff += $txd;
                            break;
                        }
                    }
                }
                $rxMbps = round(($rxDiff * 8 / $timeDiff) / 1000000, 2);
                $txMbps = round(($txDiff * 8 / $timeDiff) / 1000000, 2);
            }

            $history[] = [
                'time' => $formattedTime,
                'full_time' => $hRow->polled_at,
                'cpu' => round(100 - ($hRow->cpu_idle ?? 0), 1),
                'ram' => $hMemUsedPct,
                'rx' => $rxMbps,
                'tx' => $txMbps,
            ];

            $prevTime = $currTime;
            $prevNet = $currNet;
        }

        return response()->json([
            'vendor' => 'server',
            'device_name' => $device->name,
            'ip_address' => $device->ip_address,
            'polled_at'    => \Carbon\Carbon::parse($row->polled_at, 'UTC')->setTimezone('Asia/Jakarta')->format('Y-m-d H:i:s'),

            'system' => [
                'os_descr' => $row->sys_descr,
                'hostname' => $row->sys_name,
                'uptime_sec' => $uptimeSec,
                'uptime_human' => "{$uptimeDays}d {$uptimeHours}h {$uptimeMins}m",
            ],

            'cpu' => [
                'user_pct' => round($row->cpu_user, 1),
                'system_pct' => round($row->cpu_system, 1),
                'idle_pct' => round($row->cpu_idle, 1),
                'used_pct' => $cpuUsedPct,
            ],

            'memory' => [
                'total_kb' => (int) $row->mem_total_kb,
                'free_kb' => (int) $row->mem_free_kb,
                'cached_kb' => (int) $row->mem_cached_kb,
                'used_kb' => $memUsedKB,
                'used_pct' => $memUsedPct,
                'total_mb' => round($row->mem_total_kb / 1024, 0),
                'used_mb' => round($memUsedKB / 1024, 0),
            ],

            // Aggregate all partitions into one total
            'disk' => (function () use ($diskPartitions) {
                $totalKb = array_sum(array_column($diskPartitions, 'total_kb'));
                $usedKb = array_sum(array_column($diskPartitions, 'used_kb'));
                $freeKb = $totalKb - $usedKb;
                $usedPct = $totalKb > 0 ? round(($usedKb / $totalKb) * 100, 1) : 0;
                return [
                    'total_gb' => round($totalKb / 1024 / 1024, 2),
                    'used_gb' => round($usedKb / 1024 / 1024, 2),
                    'free_gb' => round($freeKb / 1024 / 1024, 2),
                    'used_pct' => $usedPct,
                    'partitions' => count($diskPartitions),
                ];
            })(),

            'network' => array_map(function ($iface) {
                return [
                    'name' => $iface['name'],
                    'rx_bytes' => $iface['rx_bytes'],
                    'tx_bytes' => $iface['tx_bytes'],
                    'rx_mb' => round($iface['rx_bytes'] / 1024 / 1024, 2),
                    'tx_mb' => round($iface['tx_bytes'] / 1024 / 1024, 2),
                    'speed_mbps' => $iface['speed'],
                ];
            }, $netInterfaces),

            'history' => $history,
        ]);
    }
}
