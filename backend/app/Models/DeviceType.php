<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DeviceType extends Model
{
    protected $fillable = ['name', 'label', 'icon_svg', 'is_custom'];
    
    protected $casts = [
        'is_custom' => 'boolean',
    ];

    public function getRouteKeyName()
    {
        return 'name';
    }
}
