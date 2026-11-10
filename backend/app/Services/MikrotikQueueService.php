<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DeviceLog;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MikrotikQueueService
{
    /**
     * Default overload threshold percentage.
     */
    public const DEFAULT_THRESHOLD = 90.0;

    /**
     * Recovery threshold percentage (below this, queue is considered recovered).
     */
    public const RECOVERY_THRESHOLD = 80.0;

    /**
     * Cooldown period in seconds before repeating an alert for the same queue.
     */
    public const COOLDOWN_SECONDS = 600; // 10 minutes

    /**
     * Get configured threshold percentage from database or fallback to default.
     */
    public function getThreshold(): float
    {
        $val = Setting::where('key', 'mikrotik_queue_threshold_percent')->value('value');
        if ($val !== null && is_numeric($val) && (float)$val > 0) {
            return (float)$val;
        }
        return self::DEFAULT_THRESHOLD;
    }

    /**
     * Parse raw RouterOS Simple Queues into structured metrics.
     *
     * @param array<int, array<string, string>> $rawQueues
     * @param float $threshold
     * @return array<int, array<string, mixed>>
     */
    public function parseSimpleQueues(array $rawQueues, float $threshold): array
    {
        $parsed = [];

        foreach ($rawQueues as $q) {
            $name     = $q['name'] ?? 'Unnamed';
            $target   = $q['target'] ?? '';
            $disabled = ($q['disabled'] ?? 'false') === 'true';

            // RouterOS returns "upload/download" strings
            $maxLimit = explode('/', $q['max-limit'] ?? '0/0');
            $upMax    = isset($maxLimit[0]) ? (float)$maxLimit[0] : 0.0;
            $downMax  = isset($maxLimit[1]) ? (float)$maxLimit[1] : 0.0;

            $rate   = explode('/', $q['rate'] ?? '0/0');
            $upRate = isset($rate[0]) ? (float)$rate[0] : 0.0;
            $downRate = isset($rate[1]) ? (float)$rate[1] : 0.0;

            $dropped   = explode('/', $q['dropped'] ?? '0/0');
            $upDrops   = isset($dropped[0]) ? (int)$dropped[0] : 0;
            $downDrops = isset($dropped[1]) ? (int)$dropped[1] : 0;

            $bytes   = explode('/', $q['bytes'] ?? '0/0');
            $upBytes = isset($bytes[0]) ? (float)$bytes[0] : 0.0;
            $downBytes = isset($bytes[1]) ? (float)$bytes[1] : 0.0;

            $packets   = explode('/', $q['packets'] ?? '0/0');
            $upPackets = isset($packets[0]) ? (int)$packets[0] : 0;
            $downPackets = isset($packets[1]) ? (int)$packets[1] : 0;

            // Usage percentages
            $upPercent = ($upMax > 0) ? round(($upRate / $upMax) * 100, 1) : 0.0;
            $downPercent = ($downMax > 0) ? round(($downRate / $downMax) * 100, 1) : 0.0;

            // Overload detection (traffic >= threshold OR packet drops > 0)
            $upOverloaded   = !$disabled && (($upMax > 0 && $upPercent >= $threshold) || $upDrops > 0);
            $downOverloaded = !$disabled && (($downMax > 0 && $downPercent >= $threshold) || $downDrops > 0);
            $isOverloaded   = $upOverloaded || $downOverloaded;

            $parsed[] = [
                'id'                     => $q['.id'] ?? '',
                'name'                   => $name,
                'target'                 => $target,
                'disabled'               => $disabled,
                'dynamic'                => ($q['dynamic'] ?? 'false') === 'true',
                'comment'                => $q['comment'] ?? '',
                'upload_rate'            => $upRate,
                'upload_rate_formatted'  => $this->formatBps($upRate),
                'download_rate'          => $downRate,
                'download_rate_formatted'=> $this->formatBps($downRate),
                'upload_max_limit'       => $upMax,
                'upload_max_formatted'   => $this->formatBps($upMax),
                'download_max_limit'     => $downMax,
                'download_max_formatted' => $this->formatBps($downMax),
                'upload_usage_percent'   => $upPercent,
                'download_usage_percent' => $downPercent,
                'upload_dropped'         => $upDrops,
                'download_dropped'       => $downDrops,
                'upload_bytes'           => $upBytes,
                'download_bytes'         => $downBytes,
                'upload_packets'         => $upPackets,
                'download_packets'       => $downPackets,
                'is_upload_overloaded'   => $upOverloaded,
                'is_download_overloaded' => $downOverloaded,
                'is_overloaded'          => $isOverloaded,
            ];
        }

        return $parsed;
    }

    /**
     * Parse raw RouterOS Queue Trees into structured metrics.
     *
     * @param array<int, array<string, string>> $rawTrees
     * @param float $threshold
     * @return array<int, array<string, mixed>>
     */
    public function parseQueueTrees(array $rawTrees, float $threshold): array
    {
        $parsed = [];

        foreach ($rawTrees as $t) {
            $name     = $t['name'] ?? 'Unnamed';
            $parent   = $t['parent'] ?? 'global';
            $disabled = ($t['disabled'] ?? 'false') === 'true';

            $maxLimit = isset($t['max-limit']) ? (float)$t['max-limit'] : 0.0;
            $rate     = isset($t['rate']) ? (float)$t['rate'] : 0.0;
            $drops    = isset($t['dropped']) ? (int)$t['dropped'] : 0;
            $bytes    = isset($t['bytes']) ? (float)$t['bytes'] : 0.0;
            $packets  = isset($t['packets']) ? (int)$t['packets'] : 0;

            $percent = ($maxLimit > 0) ? round(($rate / $maxLimit) * 100, 1) : 0.0;
            $isOverloaded = !$disabled && (($maxLimit > 0 && $percent >= $threshold) || $drops > 0);

            $parsed[] = [
                'id'                 => $t['.id'] ?? '',
                'name'               => $name,
                'parent'             => $parent,
                'packet_mark'        => $t['packet-mark'] ?? '',
                'disabled'           => $disabled,
                'comment'            => $t['comment'] ?? '',
                'rate'               => $rate,
                'rate_formatted'     => $this->formatBps($rate),
                'max_limit'          => $maxLimit,
                'max_limit_formatted'=> $this->formatBps($maxLimit),
                'usage_percent'      => $percent,
                'dropped'            => $drops,
                'bytes'              => $bytes,
                'packets'            => $packets,
                'is_overloaded'      => $isOverloaded,
            ];
        }

        return $parsed;
    }

    /**
     * Process queues for a device: evaluate alerts, enforce cooldown, and trigger recovery notifications.
     */
    public function checkAndNotify(Device $device, array $simpleQueues, array $queueTrees, float $threshold): array
    {
        $alertsTriggered = 0;
        $recoveriesTriggered = 0;

        // 1. Process Simple Queues
        foreach ($simpleQueues as $q) {
            if ($q['disabled']) {
                continue;
            }

            $cacheKeyCooldown = "mk_q_cooldown_{$device->id}_simple_{$q['name']}";
            $cacheKeyState    = "mk_q_state_{$device->id}_simple_{$q['name']}";

            if ($q['is_overloaded']) {
                $alreadyOnCooldown = Cache::has($cacheKeyCooldown);
                if (!$alreadyOnCooldown) {
                    $this->triggerSimpleQueueAlert($device, $q, $threshold);
                    Cache::put($cacheKeyCooldown, true, now()->addSeconds(self::COOLDOWN_SECONDS));
                    Cache::put($cacheKeyState, [
                        'overloaded' => true,
                        'name'       => $q['name'],
                        'target'     => $q['target'],
                        'since'      => now()->toIso8601String(),
                    ], now()->addHours(24));
                    $alertsTriggered++;
                }
            } else {
                // Check if queue has recovered (usage < RECOVERY_THRESHOLD and drops == 0)
                $wasOverloaded = Cache::get($cacheKeyState);
                if ($wasOverloaded && $q['download_usage_percent'] < self::RECOVERY_THRESHOLD && $q['upload_usage_percent'] < self::RECOVERY_THRESHOLD) {
                    $this->triggerSimpleQueueRecovery($device, $q);
                    Cache::forget($cacheKeyState);
                    Cache::forget($cacheKeyCooldown);
                    $recoveriesTriggered++;
                }
            }
        }

        // 2. Process Queue Trees
        foreach ($queueTrees as $t) {
            if ($t['disabled']) {
                continue;
            }

            $cacheKeyCooldown = "mk_q_cooldown_{$device->id}_tree_{$t['name']}";
            $cacheKeyState    = "mk_q_state_{$device->id}_tree_{$t['name']}";

            if ($t['is_overloaded']) {
                $alreadyOnCooldown = Cache::has($cacheKeyCooldown);
                if (!$alreadyOnCooldown) {
                    $this->triggerQueueTreeAlert($device, $t, $threshold);
                    Cache::put($cacheKeyCooldown, true, now()->addSeconds(self::COOLDOWN_SECONDS));
                    Cache::put($cacheKeyState, [
                        'overloaded' => true,
                        'name'       => $t['name'],
                        'parent'     => $t['parent'],
                        'since'      => now()->toIso8601String(),
                    ], now()->addHours(24));
                    $alertsTriggered++;
                }
            } else {
                $wasOverloaded = Cache::get($cacheKeyState);
                if ($wasOverloaded && $t['usage_percent'] < self::RECOVERY_THRESHOLD) {
                    $this->triggerQueueTreeRecovery($device, $t);
                    Cache::forget($cacheKeyState);
                    Cache::forget($cacheKeyCooldown);
                    $recoveriesTriggered++;
                }
            }
        }

        return [
            'alerts'     => $alertsTriggered,
            'recoveries' => $recoveriesTriggered,
        ];
    }

    /**
     * Send alert for an overloaded Simple Queue.
     */
    private function triggerSimpleQueueAlert(Device $device, array $q, float $threshold): void
    {
        $timeStr = now()->format('Y-m-d H:i:s');
        $downIndicator = $q['is_download_overloaded'] ? '🔴' : '🟢';
        $upIndicator   = $q['is_upload_overloaded'] ? '🔴' : '🟢';

        $msg = "🚨 *[ALERT] MIKROTIK QUEUE OVERLOAD* 🚨\n\n"
             . "🖥 *Router:* {$device->name} ({$device->ip_address})\n"
             . "📦 *Tipe:* Simple Queue\n"
             . "🏷 *Nama Antrean:* `{$q['name']}`\n"
             . "🎯 *Target:* `{$q['target']}`\n\n"
             . "📊 *Penggunaan Bandwidth:*\n"
             . "• *Download:* {$q['download_rate_formatted']} / {$q['download_max_formatted']} ({$q['download_usage_percent']}%) {$downIndicator}\n"
             . "• *Upload:* {$q['upload_rate_formatted']} / {$q['upload_max_formatted']} ({$q['upload_usage_percent']}%) {$upIndicator}\n"
             . "⚠️ *Packet Drops:* " . ($q['download_dropped'] + $q['upload_dropped']) . " packet(s)\n\n"
             . "⏰ *Waktu:* {$timeStr}\n"
             . "📌 *Status:* Bandwidth mencapai ambang batas ({$threshold}%) atau buffer penuh!";

        $this->sendTelegramMessage($msg);

        // Record in DeviceLog
        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => null,
            'event_type' => 'error',
            'message'    => "Queue '{$q['name']}' overload: DL {$q['download_usage_percent']}% ({$q['download_rate_formatted']}), UL {$q['upload_usage_percent']}% ({$q['upload_rate_formatted']}), Drops: " . ($q['download_dropped'] + $q['upload_dropped']),
            'metadata'   => [
                'type'             => 'simple_queue',
                'name'             => $q['name'],
                'target'           => $q['target'],
                'download_percent' => $q['download_usage_percent'],
                'upload_percent'   => $q['upload_usage_percent'],
                'dropped'          => $q['download_dropped'] + $q['upload_dropped'],
            ],
        ]);
    }

    /**
     * Send recovery notification for Simple Queue.
     */
    private function triggerSimpleQueueRecovery(Device $device, array $q): void
    {
        $timeStr = now()->format('Y-m-d H:i:s');

        $msg = "✅ *[RECOVERY] MIKROTIK QUEUE NORMAL* ✅\n\n"
             . "🖥 *Router:* {$device->name} ({$device->ip_address})\n"
             . "📦 *Tipe:* Simple Queue\n"
             . "🏷 *Nama Antrean:* `{$q['name']}`\n"
             . "🎯 *Target:* `{$q['target']}`\n\n"
             . "📊 *Trafik Saat Ini:*\n"
             . "• *Download:* {$q['download_rate_formatted']} / {$q['download_max_formatted']} ({$q['download_usage_percent']}%)\n"
             . "• *Upload:* {$q['upload_rate_formatted']} / {$q['upload_max_formatted']} ({$q['upload_usage_percent']}%)\n\n"
             . "⏰ *Waktu:* {$timeStr}\n"
             . "✨ *Status:* Antrean telah kembali normal dan berada di bawah ambang batas.";

        $this->sendTelegramMessage($msg);

        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => null,
            'event_type' => 'status_change',
            'message'    => "Queue '{$q['name']}' recovered to normal: DL {$q['download_usage_percent']}%, UL {$q['upload_usage_percent']}%",
            'metadata'   => [
                'type'             => 'simple_queue',
                'name'             => $q['name'],
                'target'           => $q['target'],
                'download_percent' => $q['download_usage_percent'],
                'upload_percent'   => $q['upload_usage_percent'],
            ],
        ]);
    }

    /**
     * Send alert for an overloaded Queue Tree.
     */
    private function triggerQueueTreeAlert(Device $device, array $t, float $threshold): void
    {
        $timeStr = now()->format('Y-m-d H:i:s');

        $msg = "🚨 *[ALERT] MIKROTIK QUEUE TREE OVERLOAD* 🚨\n\n"
             . "🖥 *Router:* {$device->name} ({$device->ip_address})\n"
             . "🌳 *Tipe:* Queue Tree\n"
             . "🏷 *Nama Antrean:* `{$t['name']}`\n"
             . "🌿 *Parent:* `{$t['parent']}`\n"
             . "🏷 *Packet Mark:* `{$t['packet_mark']}`\n\n"
             . "📊 *Penggunaan Bandwidth:*\n"
             . "• *Rate:* {$t['rate_formatted']} / {$t['max_limit_formatted']} ({$t['usage_percent']}%) 🔴\n"
             . "⚠️ *Packet Drops:* {$t['dropped']} packet(s)\n\n"
             . "⏰ *Waktu:* {$timeStr}\n"
             . "📌 *Status:* Bandwidth melebihi ambang batas ({$threshold}%) atau antrean drop!";

        $this->sendTelegramMessage($msg);

        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => null,
            'event_type' => 'error',
            'message'    => "Queue Tree '{$t['name']}' overload: Rate {$t['rate_formatted']} ({$t['usage_percent']}%), Drops: {$t['dropped']}",
            'metadata'   => [
                'type'          => 'queue_tree',
                'name'          => $t['name'],
                'parent'        => $t['parent'],
                'usage_percent' => $t['usage_percent'],
                'dropped'       => $t['dropped'],
            ],
        ]);
    }

    /**
     * Send recovery notification for Queue Tree.
     */
    private function triggerQueueTreeRecovery(Device $device, array $t): void
    {
        $timeStr = now()->format('Y-m-d H:i:s');

        $msg = "✅ *[RECOVERY] MIKROTIK QUEUE TREE NORMAL* ✅\n\n"
             . "🖥 *Router:* {$device->name} ({$device->ip_address})\n"
             . "🌳 *Tipe:* Queue Tree\n"
             . "🏷 *Nama Antrean:* `{$t['name']}`\n\n"
             . "📊 *Trafik Saat Ini:*\n"
             . "• *Rate:* {$t['rate_formatted']} / {$t['max_limit_formatted']} ({$t['usage_percent']}%)\n\n"
             . "⏰ *Waktu:* {$timeStr}\n"
             . "✨ *Status:* Antrean telah kembali normal.";

        $this->sendTelegramMessage($msg);

        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => null,
            'event_type' => 'status_change',
            'message'    => "Queue Tree '{$t['name']}' recovered to normal: Rate {$t['rate_formatted']} ({$t['usage_percent']}%)",
            'metadata'   => [
                'type'          => 'queue_tree',
                'name'          => $t['name'],
                'usage_percent' => $t['usage_percent'],
            ],
        ]);
    }

    /**
     * Send message to Telegram Bot if token and chat ID are configured.
     */
    public function sendTelegramMessage(string $markdownMessage): bool
    {
        $token  = Setting::where('key', 'telegram_bot_token')->value('value');
        $chatID = Setting::where('key', 'telegram_chat_id')->value('value');

        if (!$token || !$chatID) {
            return false;
        }

        try {
            $resp = Http::timeout(5)->post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id'    => $chatID,
                'text'       => $markdownMessage,
                'parse_mode' => 'Markdown',
            ]);
            return $resp->successful();
        } catch (\Throwable $e) {
            Log::error("Failed to send Telegram queue alert: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Convert bps to human readable string (bps, Kbps, Mbps, Gbps).
     */
    public function formatBps(float $bps): string
    {
        if ($bps <= 0) {
            return '0 bps';
        }
        if ($bps >= 1_000_000_000) {
            return round($bps / 1_000_000_000, 2) . ' Gbps';
        }
        if ($bps >= 1_000_000) {
            return round($bps / 1_000_000, 2) . ' Mbps';
        }
        if ($bps >= 1_000) {
            return round($bps / 1_000, 1) . ' Kbps';
        }
        return round($bps, 0) . ' bps';
    }
}
