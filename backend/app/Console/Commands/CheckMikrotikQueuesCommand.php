<?php

namespace App\Console\Commands;

use App\Models\Device;
use App\Services\DeviceCredentialService;
use App\Services\MikrotikQueueService;
use App\Services\MikrotikService;
use Illuminate\Console\Command;

class CheckMikrotikQueuesCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'nms:check-queues';

    /**
     * The console command description.
     */
    protected $description = 'Poll active MikroTik devices for queue overloads and send alerts if saturated';

    public function handle(DeviceCredentialService $credService, MikrotikQueueService $queueService): int
    {
        $devices = Device::where('is_active', true)
            ->where('vendor', 'mikrotik')
            ->get();

        if ($devices->isEmpty()) {
            $this->info('No active MikroTik devices found.');
            return self::SUCCESS;
        }

        $threshold = $queueService->getThreshold();
        $this->info("Checking queues for {$devices->count()} MikroTik device(s) [Threshold: {$threshold}%]...");

        $totalAlerts = 0;
        $totalRecoveries = 0;

        foreach ($devices as $device) {
            $creds = $credService->getMikrotikCredentials($device);
            if (!$creds) {
                $this->warn("Device '{$device->name}' ({$device->ip_address}) has no MikroTik API credentials configured.");
                continue;
            }

            $service = new MikrotikService($device->ip_address, $creds['api_port'], 5);

            try {
                $service->connect($creds['api_user'], $creds['api_pass']);
                $simpleQueues = $queueService->parseSimpleQueues($service->getSimpleQueues(), $threshold);
                $queueTrees   = $queueService->parseQueueTrees($service->getQueueTrees(), $threshold);
                $service->disconnect();

                $stats = $queueService->checkAndNotify($device, $simpleQueues, $queueTrees, $threshold);
                $totalAlerts += $stats['alerts'];
                $totalRecoveries += $stats['recoveries'];

                $this->line(" - {$device->name}: " . count($simpleQueues) . " Simple, " . count($queueTrees) . " Tree. Alerts: {$stats['alerts']}, Recoveries: {$stats['recoveries']}");
            } catch (\Throwable $e) {
                $service->disconnect();
                $this->error(" - {$device->name} ({$device->ip_address}) error: " . $e->getMessage());
            }
        }

        $this->info("Done. Total alerts sent: {$totalAlerts}, total recoveries sent: {$totalRecoveries}.");
        return self::SUCCESS;
    }
}

