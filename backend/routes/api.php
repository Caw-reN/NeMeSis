<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceConfigController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\DeviceTypeController;
use App\Http\Controllers\Api\MetricsController;
use App\Http\Controllers\Api\TopologyController;
use App\Http\Controllers\Api\VpsMetricsController;
use App\Http\Controllers\SettingController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| NMS — API Routes
|--------------------------------------------------------------------------
| All routes are prefixed with /api (set in bootstrap/app.php)
| Protected routes require: Authorization: Bearer {sanctum_token}
*/

// =========================================================================
// Authentication (public)
// =========================================================================
Route::prefix('auth')->group(function () {
    Route::post('login',  [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me',      [AuthController::class, 'me']);
    });
});

// =========================================================================
// Protected Routes — require valid Sanctum token
// =========================================================================
Route::middleware('auth:sanctum')->group(function () {

    // Dashboard
    Route::get('dashboard/summary', [DashboardController::class, 'summary']);

    // Settings
    Route::get('settings', [SettingController::class, 'index']);
    Route::post('settings', [SettingController::class, 'store']);

    // Devices
    Route::delete('devices/bulk',             [DeviceController::class, 'bulkDestroy']);
    Route::apiResource('devices', DeviceController::class);
    Route::apiResource('device_types', DeviceTypeController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('devices/{device}/logs',       [DeviceController::class, 'logs']);
    Route::get('devices/{device}/interfaces', [DeviceController::class, 'interfaces']);

    // Config — Fase 3b (Write Mode)
    Route::post('/devices/{device}/config/port', [DeviceConfigController::class, 'togglePort']);
    Route::post('/devices/{device}/config/port-name', [DeviceConfigController::class, 'renamePort']);
    Route::post('/devices/{device}/config/vlan', [DeviceConfigController::class, 'changeVlan']);
    Route::post('/devices/{device}/config/port-config', [DeviceConfigController::class, 'updatePortConfig']);
    Route::post('devices/{device}/config/reboot',  [DeviceConfigController::class, 'reboot']);
    Route::post('devices/{device}/config/execute', [DeviceConfigController::class, 'executeTerminal']);
    Route::post('devices/{device}/config/vlan/create', [DeviceConfigController::class, 'createVlan']);
    Route::post('devices/{device}/config/vlan/delete', [DeviceConfigController::class, 'deleteVlan']);

    // Topology
    Route::get('topology', [TopologyController::class, 'index']);
    Route::post('topology/discover',          [TopologyController::class, 'discover']);
    Route::post('topology/links',             [TopologyController::class, 'storeLink']);
    Route::put('topology/links/{link}',       [TopologyController::class, 'updateLink']);
    Route::delete('topology/links/{link}',    [TopologyController::class, 'destroyLink']);

    Route::post('topology/shapes',            [TopologyController::class, 'storeShape']);
    Route::put('topology/shapes/{shape}',     [TopologyController::class, 'updateShape']);
    Route::delete('topology/shapes/{shape}',  [TopologyController::class, 'destroyShape']);
    Route::post('topology/positions',         [TopologyController::class, 'savePositions']);

    // Metrics — Fase 3a (Read Mode)
    Route::get('devices/{device}/metrics/mikrotik', [MetricsController::class, 'mikrotik']);
    Route::get('devices/{device}/metrics/cisco',    [MetricsController::class, 'cisco']);
    Route::get('devices/{device}/metrics/vps',      [VpsMetricsController::class, 'show']);

    // Area Maps
    Route::apiResource('areas', \App\Http\Controllers\Api\AreaController::class);
    Route::post('areas/{area}/upload-image', [\App\Http\Controllers\Api\AreaController::class, 'uploadImage']);
});
