<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Device;

$devices = Device::whereNotNull('icon_svg')->get();
$count = 0;
foreach ($devices as $device) {
    if (strpos($device->icon_svg, '<image') !== false) {
        if (preg_match('/width="([0-9.]+)"/', $device->icon_svg, $matches)) {
            $width = (float)$matches[1];
            if ($width > 75) {
                $newWidth = 75;
                $newX = 12 - ($newWidth / 2);
                
                $newSvg = preg_replace('/x="[^"]+"/', 'x="' . $newX . '"', $device->icon_svg);
                $newSvg = preg_replace('/width="[^"]+"/', 'width="' . $newWidth . '"', $newSvg);
                
                $device->icon_svg = $newSvg;
                $device->save();
                $count++;
                echo "Capped device {$device->id} to width {$newWidth}\n";
            }
        }
    }
}
echo "Capped {$count} devices.\n";
