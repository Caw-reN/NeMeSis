<?php

namespace App\Http\Resources;

use App\Models\Device;
use App\Models\TopologyLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Transforms topology data into Vis.js compatible nodes & edges format.
 *
 * Node shape:  { id, label, group, title, status, ... }
 * Edge shape:  { id, from, to, label, ... }
 */
class TopologyResource extends JsonResource
{
    /**
     * $resource is a collection of devices (nodes).
     * $this->additional['links'] holds the topology links (edges).
     */
    public function toArray(Request $request): array
    {
        /** @var Device $device */
        $device = $this->resource;

        return [
            // Vis.js node format
            'id'     => $device->id,
            'label'  => $device->name,
            'title'  => "{$device->ip_address} | {$device->vendor} | Status: {$device->status}",
            'group'  => $device->vendor,  // Used for node icon grouping in Vis.js
            'status' => $device->status,
            'data'   => [
                'ip_address'   => $device->ip_address,
                'type'         => $device->type,
                'device_role'  => $device->device_role,
                'vendor'       => $device->vendor,
                'latency_ms'   => $device->latency_ms,
                'last_seen_at' => $device->last_seen_at?->toIso8601String(),
                'location'     => $device->location,
                'icon_svg'     => $device->icon_svg,
            ],
        ];
    }
}
