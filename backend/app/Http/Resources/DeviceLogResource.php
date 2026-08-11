<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeviceLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'device_id'  => $this->device_id,
            'event_type' => $this->event_type,
            'message'    => $this->message,
            'metadata'   => $this->metadata,
            'actor'      => $this->user_id
                ? ['id' => $this->user_id, 'name' => $this->user?->name]
                : ['id' => null, 'name' => 'System (Worker)'],
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
