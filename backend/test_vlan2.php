<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$device = \App\Models\Device::where('vendor', 'cisco')->first();
$credService = app(\App\Services\DeviceCredentialService::class);
$creds = $credService->getCiscoCredentials($device);

$service = new \App\Services\CiscoSshService($device->ip_address, $creds['ssh_port'], 10);

try {
    echo "Connecting...\n";
    $service->connect($creds['ssh_user'], $creds['ssh_pass'], $creds['enable_pass'] ?? '');
    echo "Connected. Changing VLAN...\n";
    $service->setPortVlan('Gi1/0/17', 1010);
    echo "Success\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
} finally {
    $service->disconnect();
}
