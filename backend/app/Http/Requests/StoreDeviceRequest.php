<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'            => ['required', 'string', 'max:100'],
            'ip_address'      => ['required', 'ip', 'unique:devices,ip_address'],
            'type'            => ['required', 'in:router,switch,server,ap,firewall,other'],
            'vendor'          => ['required', 'in:mikrotik,cisco,generic'],
            'snmp_enabled'    => ['boolean'],
            'snmp_community'  => ['nullable', 'string', 'max:100', 'required_if:snmp_enabled,true'],
            'snmp_version'    => ['in:v1,v2c,v3'],
            'location'        => ['nullable', 'string', 'max:150'],
            'description'     => ['nullable', 'string', 'max:500'],
            'is_active'       => ['boolean'],
            // Credential fields — will be encrypted before storage
            'credentials'          => ['nullable', 'array'],
            'credentials.password' => ['nullable', 'string'],
            'credentials.api_token'=> ['nullable', 'string'],
            'credentials.ssh_key'  => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'ip_address.ip'     => 'Alamat IP tidak valid.',
            'ip_address.unique' => 'Alamat IP sudah terdaftar.',
            'snmp_community.required_if' => 'SNMP Community wajib diisi jika SNMP aktif.',
        ];
    }
}
