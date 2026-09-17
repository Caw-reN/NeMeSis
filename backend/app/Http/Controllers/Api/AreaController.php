<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\Device;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AreaController extends Controller
{
    public function index()
    {
        return response()->json(Area::withCount('devices')->get());
    }

    public function show(Area $area)
    {
        return response()->json($area->load('devices'));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $area = Area::create($validated);
        return response()->json($area, 201);
    }

    public function update(Request $request, Area $area)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'canvas_data' => 'nullable|string',
        ]);

        $area->update($validated);
        return response()->json($area);
    }

    public function destroy(Area $area)
    {
        if ($area->image_path) {
            Storage::disk('public')->delete($area->image_path);
        }
        $area->delete();
        return response()->json(null, 204);
    }

    public function uploadImage(Request $request, Area $area)
    {
        $request->validate([
            'image' => 'required|image|max:10240', // max 10MB
        ]);

        if ($area->image_path) {
            Storage::disk('public')->delete($area->image_path);
        }

        $path = $request->file('image')->store('areas', 'public');
        $area->update(['image_path' => $path]);

        return response()->json(['image_path' => $path]);
    }
}
