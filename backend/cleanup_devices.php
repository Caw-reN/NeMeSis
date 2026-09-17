<?php
define('LARAVEL_START', microtime(true));
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();

// IDs to KEEP — adjust this list if needed
$keepIds = [7, 8, 9];

echo "=== Devices to KEEP ===\n";
$kept = App\Models\Device::whereIn('id', $keepIds)->get();
foreach ($kept as $d) {
    echo "  KEEP: [{$d->vendor}] {$d->name} ({$d->ip_address})\n";
}

echo "\n=== Deleting all other devices ===\n";
$toDelete = App\Models\Device::whereNotIn('id', $keepIds)->get();
$count = $toDelete->count();
echo "Will delete {$count} device(s)...\n";

// Also delete topology links for those devices
$ids = $toDelete->pluck('id')->toArray();
$linksDeleted = App\Models\TopologyLink::where(function($q) use ($ids) {
    $q->whereIn('source_device_id', $ids)
      ->orWhereIn('target_device_id', $ids);
})->delete();
echo "Topology links deleted: {$linksDeleted}\n";

// Delete device logs
$logsDeleted = App\Models\DeviceLog::whereIn('device_id', $ids)->delete();
echo "Device logs deleted: {$logsDeleted}\n";

// Delete devices
$deleted = App\Models\Device::whereNotIn('id', $keepIds)->delete();
echo "Devices deleted: {$deleted}\n";

echo "\n=== Done! Remaining devices ===\n";
$remaining = App\Models\Device::all(['id','name','ip_address','vendor']);
foreach ($remaining as $d) {
    echo "  [{$d->vendor}] {$d->name} ({$d->ip_address})\n";
}
