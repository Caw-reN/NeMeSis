<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $deviceId = $this->route('device');

        return [
            'name'            => ['sometimes', 'string', 'max:100'],
            'ip_address'      => ['sometimes', 'ip', Rule::unique('devices', 'ip_address')->ignore($deviceId)],
            'type'            => ['sometimes', 'in:router,switch,server,ap,firewall,other'],
            'vendor'          => ['sometimes', 'in:mikrotik,cisco,generic'],
            'snmp_enabled'    => ['boolean'],
            'snmp_community'  => ['nullable', 'string', 'max:100'],
            'snmp_version'    => ['in:v1,v2c,v3'],
            'location'        => ['nullable', 'string', 'max:150'],
            'description'     => ['nullable', 'string', 'max:500'],
            'is_active'       => ['boolean'],
            'credentials'          => ['nullable', 'array'],
            'credentials.password' => ['nullable', 'string'],
            'credentials.api_token'=> ['nullable', 'string'],
            'credentials.ssh_key'  => ['nullable', 'string'],
        ];
    }
}
