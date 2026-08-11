<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScanResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id',
        'port',
        'protocol',
        'state',
        'service_name',
        'is_dangerous',
        'scanned_at',
    ];

    protected $casts = [
        'is_dangerous' => 'boolean',
        'scanned_at'   => 'datetime',
    ];

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Known dangerous ports that should not be publicly accessible.
     */
    public static array $dangerousPorts = [
        23,    // Telnet
        21,    // FTP
        69,    // TFTP
        161,   // SNMP (should be restricted)
        8291,  // Winbox (Mikrotik)
        8728,  // Mikrotik API (unencrypted)
    ];

    public static function isDangerous(int $port): bool
    {
        return in_array($port, static::$dangerousPorts);
    }
}
