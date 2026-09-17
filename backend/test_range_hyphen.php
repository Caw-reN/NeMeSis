<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$time = microtime(true);
$svc = new \App\Services\TopologyDiscoveryService(
    new \App\Services\DeviceCredentialService()
);
try {
    $summary = $svc->run(null, ['192.168.111.250-192.168.111.253']);
    echo "Finished in " . round(microtime(true) - $time, 2) . "s\n";
    print_r($summary);
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
