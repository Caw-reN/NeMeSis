<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\MetricsController;
use App\Http\Controllers\Api\TopologyController;
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

    // Devices
    Route::apiResource('devices', DeviceController::class);
    Route::get('devices/{device}/logs', [DeviceController::class, 'logs']);

    // Topology
    Route::get('topology', [TopologyController::class, 'index']);
    Route::post('topology/discover',          [TopologyController::class, 'discover']);
    Route::post('topology/links',             [TopologyController::class, 'storeLink']);
    Route::put('topology/links/{link}',       [TopologyController::class, 'updateLink']);
    Route::delete('topology/links/{link}',    [TopologyController::class, 'destroyLink']);

    // Metrics — Fase 3a (Read Mode)
    Route::get('devices/{device}/metrics/mikrotik', [MetricsController::class, 'mikrotik']);
    Route::get('devices/{device}/metrics/cisco',    [MetricsController::class, 'cisco']);
});
