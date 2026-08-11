<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TopologyResource;
use App\Models\Device;
use App\Models\TopologyLink;
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
        $devices = Device::active()->get();
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
            'data'  => [
                'source_interface' => $link->source_interface,
                'target_interface' => $link->target_interface,
            ],
        ]);

        return response()->json([
            'nodes' => $nodes,
            'edges' => $edges,
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
            'label'             => ['nullable', 'string', 'max:50'],
            'source_interface'  => ['nullable', 'string', 'max:50'],
            'target_interface'  => ['nullable', 'string', 'max:50'],
        ]);

        $link = TopologyLink::firstOrCreate(
            [
                'source_device_id' => $data['source_device_id'],
                'target_device_id' => $data['target_device_id'],
            ],
            $data
        );

        return response()->json([
            'id'   => $link->id,
            'from' => $link->source_device_id,
            'to'   => $link->target_device_id,
            'type' => $link->link_type,
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
            'label'            => ['nullable', 'string', 'max:50'],
            'source_interface' => ['nullable', 'string', 'max:50'],
            'target_interface' => ['nullable', 'string', 'max:50'],
            'is_active'        => ['boolean'],
        ]);

        $link->update($data);

        return response()->json(['message' => 'Link diperbarui.', 'link' => $link->fresh()]);
    }
}
