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

$ssh = new SSH2('1.2.0.1', 22, 10);
$ssh->setPreferredAlgorithms([
    'hostkey' => ['ssh-rsa', 'ssh-dss'],
    'kex'     => ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1']
]);
$ssh->login($creds['ssh_user'], $creds['ssh_pass']);
$ssh->setTimeout(5);

$ssh->read('/[>#]/', SSH2::READ_REGEX); // initial prompt
$ssh->write("terminal length 0\n");
$ssh->read('/[>#]/', SSH2::READ_REGEX);

$ssh->write("show version\n");
$output = $ssh->read('/[>#]/', SSH2::READ_REGEX);

echo "RAW OUTPUT LENGTH: " . strlen($output) . "\n";
echo "FIRST 5 LINES (HEX DUMP):\n";
$lines = explode("\n", $output);
for ($i = 0; $i < min(5, count($lines)); $i++) {
    echo "Line $i: " . bin2hex($lines[$i]) . " (" . $lines[$i] . ")\n";
}

echo "\nLAST 3 LINES (HEX DUMP):\n";
for ($i = max(0, count($lines) - 3); $i < count($lines); $i++) {
    echo "Line $i: " . bin2hex($lines[$i]) . " (" . $lines[$i] . ")\n";
}
