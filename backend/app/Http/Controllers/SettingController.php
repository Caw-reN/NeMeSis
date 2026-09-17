<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index()
    {
        return response()->json(\App\Models\Setting::pluck('value', 'key'));
    }

    public function store(Request $request)
    {
        $settings = $request->all();
        foreach ($settings as $key => $value) {
            \App\Models\Setting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }
        return response()->json(['message' => 'Settings updated successfully']);
    }
}
