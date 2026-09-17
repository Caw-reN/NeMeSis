<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TopologyResource;
use App\Models\Device;
use App\Models\DeviceLog;
use App\Models\TopologyLink;
use App\Services\TopologyDiscoveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TopologyController extends Controller
{
    /**
     * GET /api/topology
     * Returns full graph data: nodes (devices) + edges (links) in Vis.js format.
     */
    public function index(): JsonResponse
    {
        $devices = Device::active()->with('deviceType')->get();
        $links   = TopologyLink::with(['sourceDevice', 'targetDevice'])
            ->where('is_active', true)
            ->get();

        $nodes = TopologyResource::collection($devices)->resolve();

        $edges = $links->map(fn (TopologyLink $link) => [
            'id'    => $link->id,
            'from'  => $link->source_device_id,
            'to'    => $link->target_device_id,
            'label' => $link->label,
            'type'  => $link->link_type,
            'cable_type' => $link->cable_type,
            'data'  => [
                'source_interface' => $link->source_interface,
                'target_interface' => $link->target_interface,
            ],
        ]);

        $shapes = \App\Models\TopologyShape::all();

        $positionsSetting = \App\Models\Setting::where('key', 'topology_positions')->first();
        $positions = $positionsSetting ? json_decode($positionsSetting->value, true) : null;

        return response()->json([
            'nodes'     => $nodes,
            'edges'     => $edges,
            'shapes'    => $shapes,
            'positions' => $positions,
        ]);
    }

    /**
     * POST /api/topology/links
     * Create a new topology link (edge) between two devices.
     */
    public function storeLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'source_device_id'  => ['required', 'exists:devices,id'],
            'target_device_id'  => ['required', 'exists:devices,id', 'different:source_device_id'],
            'link_type'         => ['in:physical,logical,manual'],
            'cable_type'        => ['nullable', 'string', 'max:50'],
            'label'             => ['nullable', 'string', 'max:50'],
            'source_interface'  => ['nullable', 'string', 'max:50'],
            'target_interface'  => ['nullable', 'string', 'max:50'],
        ]);

        // Check if a link already exists in either direction
        $link = TopologyLink::where(function ($query) use ($data) {
            $query->where('source_device_id', $data['source_device_id'])
                  ->where('target_device_id', $data['target_device_id']);
        })->orWhere(function ($query) use ($data) {
            $query->where('source_device_id', $data['target_device_id'])
                  ->where('target_device_id', $data['source_device_id']);
        })->first();

        if ($link) {
            // If it exists in reverse, we do NOT flip the data source/target,
            // we just update the cable properties. The direction doesn't strictly matter for physical cables.
            $link->update([
                'link_type'  => $data['link_type'] ?? $link->link_type,
                'cable_type' => $data['cable_type'] ?? $link->cable_type,
                'label'      => $data['label'] ?? $link->label,
                'is_active'  => true,
            ]);
        } else {
            $link = TopologyLink::create($data);
        }

        return response()->json([
            'id'   => $link->id,
            'from' => $link->source_device_id,
            'to'   => $link->target_device_id,
            'type' => $link->link_type,
            'cable_type' => $link->cable_type,
            'label'=> $link->label,
        ], 201);
    }

    /**
     * DELETE /api/topology/links/{link}
     * Remove a topology link.
     */
    public function destroyLink(TopologyLink $link): JsonResponse
    {
        $link->delete();

        return response()->json(['message' => 'Link berhasil dihapus.']);
    }

    /**
     * PUT /api/topology/links/{link}
     * Update a topology link (e.g., change label or interface info).
     */
    public function updateLink(Request $request, TopologyLink $link): JsonResponse
    {
        $data = $request->validate([
            'link_type'        => ['in:physical,logical,manual'],
            'cable_type'       => ['nullable', 'string', 'max:50'],
            'label'            => ['nullable', 'string', 'max:50'],
            'source_interface' => ['nullable', 'string', 'max:50'],
            'target_interface' => ['nullable', 'string', 'max:50'],
            'is_active'        => ['boolean'],
        ]);

        $link->update($data);

        return response()->json(['message' => 'Link diperbarui.', 'link' => $link->fresh()]);
    }

    // =========================================================================
    // Fase 4: Auto-Discovery
    // =========================================================================

    /**
     * POST /api/topology/discover
     *
     * Trigger CDP/LLDP neighbor discovery across all eligible devices.
     * Optionally scoped to a single device via ?device_id=123 query param.
     *
     * Returns a discovery summary:
     *  - scanned:         number of devices queried
     *  - neighbors_found: total raw neighbors detected
     *  - links_created:   new topology links added
     *  - links_updated:   existing links refreshed
     *  - errors:          devices that could not be contacted
     *  - details:         per-neighbor breakdown
     */
    public function discover(Request $request, TopologyDiscoveryService $discoveryService): JsonResponse
    {
        $deviceId   = $request->integer('device_id') ?: null;
        $ipRanges   = $request->input('ip_ranges', []);
        $filterType = $request->input('filter_type', ''); // e.g. 'ap'
        
        // Normalize: remove empty entries
        $ipRanges = array_values(array_filter(array_map('trim', (array)$ipRanges)));
        $filterType = in_array($filterType, ['ap']) ? $filterType : '';

        try {
            $summary = $discoveryService->run($deviceId, $ipRanges, $filterType);
        } catch (\Throwable $e) {
            return response()->json([
                'error'   => 'Auto-discovery failed unexpectedly.',
                'details' => $e->getMessage(),
            ], 500);
        }

        // Log audit entry for the action
        \Illuminate\Support\Facades\Log::info(
            "Auto-Discovery selesai: {$summary['scanned']} device dipindai, " .
            "{$summary['links_created']} link baru, {$summary['links_updated']} link diperbarui, " .
            "{$summary['errors']} error.",
            $summary
        );

        return response()->json([
            'message' => 'Auto-Discovery berhasil dijalankan.',
            'summary' => $summary,
        ]);
    }

    /**
     * POST /api/topology/shapes
     */
    public function storeShape(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'         => 'required|in:rect,ellipse,text',
            'x'            => 'required|integer',
            'y'            => 'required|integer',
            'width'        => 'required|integer',
            'height'       => 'required|integer',
            'fill_color'   => 'nullable|string',
            'border_color' => 'nullable|string',
            'text_content' => 'nullable|string',
        ]);

        $shape = \App\Models\TopologyShape::create($data);
        return response()->json($shape, 201);
    }

    /**
     * PUT /api/topology/shapes/{shape}
     */
    public function updateShape(Request $request, \App\Models\TopologyShape $shape): JsonResponse
    {
        $data = $request->validate([
            'x'            => 'sometimes|integer',
            'y'            => 'sometimes|integer',
            'width'        => 'sometimes|integer',
            'height'       => 'sometimes|integer',
            'fill_color'   => 'nullable|string',
            'border_color' => 'nullable|string',
            'text_content' => 'nullable|string',
        ]);

        $shape->update($data);
        return response()->json($shape);
    }

    /**
     * DELETE /api/topology/shapes/{shape}
     */
    public function destroyShape(\App\Models\TopologyShape $shape): JsonResponse
    {
        $shape->delete();
        return response()->json(['message' => 'Shape deleted.']);
    }

    /**
     * POST /api/topology/positions
     */
    public function savePositions(Request $request): JsonResponse
    {
        $request->validate([
            'positions' => ['required', 'array'],
        ]);

        \App\Models\Setting::updateOrCreate(
            ['key' => 'topology_positions'],
            ['value' => json_encode($request->input('positions'))]
        );

        return response()->json(['message' => 'Posisi topologi berhasil disimpan.']);
    }
}
