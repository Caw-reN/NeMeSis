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
            // Credential fields — same structure as StoreDeviceRequest
            'credentials'                    => ['nullable', 'array'],
            'credentials.mikrotik'           => ['nullable', 'array'],
            'credentials.mikrotik.api_user'  => ['nullable', 'string', 'max:100'],
            'credentials.mikrotik.api_pass'  => ['nullable', 'string', 'max:255'],
            'credentials.mikrotik.api_port'  => ['nullable', 'integer', 'min:1', 'max:65535'],
            'credentials.cisco'              => ['nullable', 'array'],
            'credentials.cisco.ssh_user'     => ['nullable', 'string', 'max:100'],
            'credentials.cisco.ssh_pass'     => ['nullable', 'string', 'max:255'],
            'credentials.cisco.enable_pass'  => ['nullable', 'string', 'max:255'],
            'credentials.cisco.ssh_port'     => ['nullable', 'integer', 'min:1', 'max:65535'],
        ];
    }
}
