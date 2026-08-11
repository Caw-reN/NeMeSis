<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;

class Device extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'ip_address',
        'type',
        'vendor',
        'status',
        'snmp_enabled',
        'snmp_community',
        'snmp_version',
        'credentials',
        'location',
        'description',
        'is_active',
        'last_seen_at',
        'latency_ms',
    ];

    protected $casts = [
        'snmp_enabled' => 'boolean',
        'is_active'    => 'boolean',
        'last_seen_at' => 'datetime',
        'latency_ms'   => 'float',
    ];

    /**
     * Hidden from JSON serialization — never expose raw encrypted blob.
     */
    protected $hidden = [
        'credentials',
    ];

    // -------------------------------------------------------------------------
    // Credential Encryption / Decryption
    // Credentials are stored as AES-256-CBC encrypted JSON strings.
    // Only Laravel (via Crypt facade) can decrypt them.
    // The Go worker NEVER touches this field.
    // -------------------------------------------------------------------------

    /**
     * Set encrypted credentials.
     * Accepts an array: ['password' => '...', 'api_token' => '...', 'ssh_key' => '...']
     */
    public function setCredentialsAttribute(?array $value): void
    {
        $this->attributes['credentials'] = $value
            ? Crypt::encryptString(json_encode($value))
            : null;
    }

    /**
     * Get decrypted credentials as an array.
     * Returns null if no credentials are stored.
     */
    public function getDecryptedCredentials(): ?array
    {
        if (empty($this->attributes['credentials'])) {
            return null;
        }

        try {
            return json_decode(
                Crypt::decryptString($this->attributes['credentials']),
                true
            );
        } catch (\Exception) {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Relationships
    // -------------------------------------------------------------------------

    public function logs(): HasMany
    {
        return $this->hasMany(DeviceLog::class);
    }

    public function scanResults(): HasMany
    {
        return $this->hasMany(ScanResult::class);
    }

    public function sourceLinks(): HasMany
    {
        return $this->hasMany(TopologyLink::class, 'source_device_id');
    }

    public function targetLinks(): HasMany
    {
        return $this->hasMany(TopologyLink::class, 'target_device_id');
    }

    // -------------------------------------------------------------------------
    // Scopes
    // -------------------------------------------------------------------------

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeUp($query)
    {
        return $query->where('status', 'up');
    }

    public function scopeDown($query)
    {
        return $query->where('status', 'down');
    }

    public function scopeSnmpEnabled($query)
    {
        return $query->where('snmp_enabled', true);
    }
}
