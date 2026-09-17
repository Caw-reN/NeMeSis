<?php
define('LARAVEL_START', microtime(true));
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();

$devices = App\Models\Device::all(['id','name','ip_address','vendor','type']);
foreach($devices as $d) {
    echo $d->id . ' | [' . $d->vendor . '] ' . $d->name . ' (' . $d->ip_address . ')' . PHP_EOL;
}
echo 'Total: ' . $devices->count() . PHP_EOL;
