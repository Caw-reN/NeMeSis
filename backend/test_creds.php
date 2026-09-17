<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$device = \App\Models\Device::where('vendor', 'cisco')->first();
$credService = app(\App\Services\DeviceCredentialService::class);
$creds = $credService->getCiscoCredentials($device);
print_r($creds);
