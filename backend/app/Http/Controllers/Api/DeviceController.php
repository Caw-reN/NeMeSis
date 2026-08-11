<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeviceRequest;
use App\Http\Requests\UpdateDeviceRequest;
use App\Http\Resources\DeviceLogResource;
use App\Http\Resources\DeviceResource;
use App\Models\Device;
use App\Models\DeviceLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DeviceController extends Controller
{
    /**
     * GET /api/devices
     * List all devices with optional filtering.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $devices = Device::query()
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->vendor, fn ($q, $v) => $q->where('vendor', $v))
            ->when($request->type,   fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) =>
                $q->where(fn ($sub) =>
                    $sub->where('name', 'like', "%{$s}%")
                        ->orWhere('ip_address', 'like', "%{$s}%")
                        ->orWhere('location', 'like', "%{$s}%")
                )
            )
            ->latest()
            ->paginate($request->per_page ?? 20);

        return DeviceResource::collection($devices);
    }

    /**
     * POST /api/devices
     * Create a new device.
     */
    public function store(StoreDeviceRequest $request): JsonResponse
    {
        $data = $request->validated();

        // Extract credentials before passing to model
        // The Device model's setCredentialsAttribute will handle encryption
        $device = Device::create($data);

        DeviceLog::system(
            $device->id,
            'discovery',
            "Device '{$device->name}' ({$device->ip_address}) ditambahkan secara manual.",
            ['added_by_user_id' => $request->user()->id]
        );

        return response()->json(new DeviceResource($device), 201);
    }

    /**
     * GET /api/devices/{device}
     * Show a single device with its recent logs.
     */
    public function show(Device $device): JsonResponse
    {
        $device->load(['scanResults' => fn ($q) => $q->where('state', 'open')->orderBy('port')]);

        return response()->json([
            'device'       => new DeviceResource($device),
            'open_ports'   => $device->scanResults->map(fn ($r) => [
                'port'         => $r->port,
                'protocol'     => $r->protocol,
                'service_name' => $r->service_name,
                'is_dangerous' => $r->is_dangerous,
                'scanned_at'   => $r->scanned_at?->toIso8601String(),
            ]),
        ]);
    }

    /**
     * PUT /api/devices/{device}
     * Update device details.
     */
    public function update(UpdateDeviceRequest $request, Device $device): JsonResponse
    {
        $device->update($request->validated());

        DeviceLog::create([
            'device_id'  => $device->id,
            'user_id'    => $request->user()->id,
            'event_type' => 'config_change',
            'message'    => "Konfigurasi device diperbarui oleh {$request->user()->name}.",
            'metadata'   => ['updated_fields' => array_keys($request->validated())],
        ]);

        return response()->json(new DeviceResource($device->fresh()));
    }

    /**
     * DELETE /api/devices/{device}
     * Remove a device.
     */
    public function destroy(Request $request, Device $device): JsonResponse
    {
        $deviceName = $device->name;
        $deviceIp   = $device->ip_address;

        $device->delete();

        return response()->json([
            'message' => "Device '{$deviceName}' ({$deviceIp}) berhasil dihapus.",
        ]);
    }

    /**
     * GET /api/devices/{device}/logs
     * Get paginated logs for a device.
     */
    public function logs(Request $request, Device $device): AnonymousResourceCollection
    {
        $logs = $device->logs()
            ->with('user')
            ->when($request->event_type, fn ($q, $t) => $q->where('event_type', $t))
            ->latest()
            ->paginate($request->per_page ?? 50);

        return DeviceLogResource::collection($logs);
    }
}
