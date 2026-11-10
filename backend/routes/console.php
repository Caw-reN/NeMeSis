<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule MikroTik queue overload monitoring every minute
Schedule::command('nms:check-queues')->everyMinute()->withoutOverlapping(2);
