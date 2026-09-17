<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TopologyShape extends Model
{
    protected $fillable = [
        'type', 'x', 'y', 'width', 'height', 'fill_color', 'border_color', 'text_content', 'font_size'
    ];
}
