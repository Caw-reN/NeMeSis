<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeviceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'ip_address'     => $this->ip_address,
            'type'           => $this->type,
            'device_role'    => $this->device_role,
            'vendor'         => $this->vendor,
            'status'         => $this->status,
            'is_active'      => $this->is_active,
            'passive'        => $this->passive,
            'snmp_enabled'   => $this->snmp_enabled,
            'snmp_version'   => $this->snmp_version,
            // snmp_community exposed only for internal admin use
            'snmp_community' => $this->when($request->user()?->id, $this->snmp_community),
            'location'       => $this->location,
            'area_id'        => $this->area_id,
            'icon_svg'       => $this->icon_svg,
            'description'    => $this->description,
            'last_seen_at'   => $this->last_seen_at?->toIso8601String(),
            'latency_ms'     => $this->latency_ms,
            // NOTE: 'credentials' is intentionally excluded — never exposed via API
            'created_at'     => $this->created_at->toIso8601String(),
            'updated_at'     => $this->updated_at->toIso8601String(),
        ];
    }
}
