<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id',
        'user_id',
        'event_type',
        'message',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Create a system-generated log (no user actor — from Go worker or scheduler).
     */
    public static function system(int $deviceId, string $eventType, string $message, ?array $metadata = null): self
    {
        return static::create([
            'device_id'  => $deviceId,
            'user_id'    => null,
            'event_type' => $eventType,
            'message'    => $message,
            'metadata'   => $metadata,
        ]);
    }
}
