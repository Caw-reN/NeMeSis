<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceType;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DeviceTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $types = DeviceType::all();
        return response()->json($types);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => ['required', 'string', 'max:50', 'unique:device_types,name'],
            'label'     => ['required', 'string', 'max:100'],
            'icon_svg'  => ['nullable', 'string'],
        ]);

        $data['is_custom'] = true;

        $type = DeviceType::create($data);
        return response()->json($type, 201);
    }

    public function update(Request $request, DeviceType $deviceType): JsonResponse
    {

        $data = $request->validate([
            'label'     => ['required', 'string', 'max:100'],
            'icon_svg'  => ['nullable', 'string'],
        ]);

        $deviceType->update($data);
        return response()->json($deviceType);
    }

    public function destroy(DeviceType $deviceType): JsonResponse
    {
        if (!$deviceType->is_custom) {
            return response()->json(['error' => 'Cannot delete system default types.'], 403);
        }

        // Optional: Check if devices are using this type
        $inUse = \App\Models\Device::where('type', $deviceType->name)->exists();
        if ($inUse) {
            return response()->json(['error' => 'Cannot delete type that is currently in use by devices.'], 409);
        }

        $deviceType->delete();
        return response()->json(['message' => 'Device type deleted.']);
    }
}
