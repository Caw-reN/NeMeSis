<?php
require 'vendor/autoload.php';

use phpseclib3\Net\SSH2;
use App\Models\Device;

$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$device = Device::where('ip_address', '1.2.0.1')->first();
$credService = app(\App\Services\DeviceCredentialService::class);
$creds = $credService->getCiscoCredentials($device);

$start = microtime(true);
$ssh = new SSH2('1.2.0.1', 22, 10);
echo "new SSH2 took: " . round(microtime(true) - $start, 2) . "s\n";

$ssh->setPreferredAlgorithms([
    'hostkey' => ['ssh-rsa', 'ssh-dss'],
    'kex'     => ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1']
]);

$start = microtime(true);
$login = $ssh->login($creds['ssh_user'], $creds['ssh_pass']);
echo "login() took: " . round(microtime(true) - $start, 2) . "s\n";

$start = microtime(true);
$ssh->setTimeout(5); // 5 seconds timeout
echo "Reading initial banner/prompt...\n";
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);
echo "Reading initial prompt took: " . round(microtime(true) - $start, 2) . "s\n";
var_dump($output);

if ($ssh->isTimeout()) {
    echo "TIMED OUT waiting for prompt!\n";
}

$start = microtime(true);
$ssh->write("terminal length 0\n");
echo "Reading terminal length 0 output...\n";
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);
echo "Reading terminal length 0 took: " . round(microtime(true) - $start, 2) . "s\n";
var_dump($output);

if ($ssh->isTimeout()) {
    echo "TIMED OUT!\n";
}

$start = microtime(true);
$ssh->write("show version\n");
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);
echo "show version took: " . round(microtime(true) - $start, 2) . "s\n";

$start = microtime(true);
$ssh->write("show interface status\n");
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);
echo "show interface status took: " . round(microtime(true) - $start, 2) . "s\n";

$start = microtime(true);
$ssh->write("show interfaces\n");
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);
echo "show interfaces took: " . round(microtime(true) - $start, 2) . "s\n";

$start = microtime(true);
$ssh->write("show vlan brief\n");
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);
echo "show vlan brief took: " . round(microtime(true) - $start, 2) . "s\n";

$start = microtime(true);
$ssh->disconnect();
echo "disconnect took: " . round(microtime(true) - $start, 2) . "s\n";
