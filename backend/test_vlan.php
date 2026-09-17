<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$device = \App\Models\Device::where('vendor', 'cisco')->first();
$credService = app(\App\Services\DeviceCredentialService::class);
$creds = $credService->getCiscoCredentials($device);

$service = new \App\Services\CiscoSshService($device->ip_address, $creds['ssh_port'], 10);
$service->connect($creds['ssh_user'], $creds['ssh_pass'], $creds['enable_pass'] ?? '');

$start = microtime(true);
$out = $service->executeTerminalCommand('show running-config');
$end = microtime(true);

echo "Took " . ($end - $start) . " seconds.\n";
echo "Length of output: " . strlen($out) . " characters.\n";

$lines = explode("\n", $out);
$trunkPorts = [];
$currentIface = null;

foreach ($lines as $line) {
    $line = trim($line);
    if (preg_match('/^interface\s+(.+)$/i', $line, $m)) {
        $currentIface = $m[1];
    } elseif ($currentIface && preg_match('/^switchport mode trunk/i', $line)) {
        $trunkPorts[] = $currentIface;
    } elseif ($line === '!') {
        $currentIface = null;
    }
}

print_r($trunkPorts);
