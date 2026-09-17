<?php

require __DIR__ . '/vendor/autoload.php';

$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();

use App\Models\Device;
use App\Services\TopologyDiscoveryService;
use App\Services\DeviceCredentialService;
use App\Services\MikrotikService;

// --- 1. Check eligible devices ---
echo "=== ACTIVE DEVICES ===\n";
$devices = Device::where('is_active', true)->get();
echo "Total active: " . $devices->count() . "\n\n";

foreach ($devices as $d) {
    $creds = is_string($d->credentials) ? json_decode($d->credentials, true) : (array)($d->credentials ?? []);
    $eligible = in_array($d->vendor, ['mikrotik','cisco']) && !empty($creds);
    echo ($eligible ? "[ELIGIBLE]" : "[SKIP]   ") . " [{$d->vendor}] {$d->name} ({$d->ip_address})\n";
    if ($eligible && isset($creds['mikrotik'])) {
        $mk = $creds['mikrotik'];
        echo "   api_user=" . ($mk['api_user'] ?? '???') . "  api_port=" . ($mk['api_port'] ?? 8728) . "\n";
    }
}

// --- 2. Try connecting to the first eligible MikroTik ---
echo "\n=== MIKROTIK CONNECTION TEST ===\n";
$mkDevice = $devices->first(fn($d) => $d->vendor === 'mikrotik' && !empty($d->credentials));

if (!$mkDevice) {
    echo "No eligible MikroTik device found. Make sure:\n";
    echo "  1. A device exists with vendor='mikrotik'\n";
    echo "  2. It has credentials configured with 'mikrotik' key\n";
    exit(0);
}

$credService = new DeviceCredentialService();
$creds = $credService->getMikrotikCredentials($mkDevice);

if (!$creds) {
    echo "getMikrotikCredentials() returned null for device: {$mkDevice->name}\n";
    exit(0);
}

echo "Connecting to {$mkDevice->ip_address}:{$creds['api_port']} as {$creds['api_user']}...\n";

try {
    $svc = new MikrotikService($mkDevice->ip_address, $creds['api_port']);
    $svc->connect($creds['api_user'], $creds['api_pass']);
    echo "Connected!\n\n";

    echo "--- ARP Table ---\n";
    $arp = $svc->getArpTable();
    echo count($arp) . " entries\n";
    foreach (array_slice($arp, 0, 5) as $row) {
        echo "  {$row['address']} | mac={$row['mac-address']} | iface={$row['interface']}\n";
    }

    echo "\n--- DHCP Leases ---\n";
    $leases = $svc->getDhcpLeases();
    echo count($leases) . " entries\n";
    foreach (array_slice($leases, 0, 5) as $row) {
        $ip = $row['active-address'] ?? $row['address'] ?? '?';
        $hn = $row['host-name'] ?? '-';
        echo "  {$ip} | host={$hn} | mac={$row['mac-address']}\n";
    }

    $svc->disconnect();
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

// --- 3. Run full discovery ---
echo "\n=== RUNNING FULL DISCOVERY ===\n";
$discSvc = new TopologyDiscoveryService($credService);
$result = $discSvc->run();
echo "Scanned:         {$result['scanned']}\n";
echo "Neighbors found: {$result['neighbors_found']}\n";
echo "Links created:   {$result['links_created']}\n";
echo "Links updated:   {$result['links_updated']}\n";
echo "Errors:          {$result['errors']}\n";

if (!empty($result['details'])) {
    echo "\nDetails:\n";
    foreach ($result['details'] as $d) {
        echo "  [{$d['protocol']}] {$d['neighbor_ip']} ({$d['neighbor_name']}) — matched=" . ($d['matched'] ? 'yes' : 'no') . "\n";
    }
}
