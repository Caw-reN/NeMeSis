<?php
define('LARAVEL_START', microtime(true));
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();

$service = app(\App\Services\TopologyDiscoveryService::class);
echo "Starting discovery with range...\n";
$time = microtime(true);
try {
    $summary = $service->run(null, ['192.168.3.0/24']);
    echo "Finished in " . round(microtime(true) - $time, 2) . "s\n";
    print_r($summary);
} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
