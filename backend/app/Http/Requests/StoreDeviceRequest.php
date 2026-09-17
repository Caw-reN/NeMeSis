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
            'ip_address'      => ['nullable', 'ip', 'unique:devices,ip_address'],
            'type'            => ['required', 'string', 'exists:device_types,name'],
            'device_role'     => ['required', 'string', 'in:infrastructure,end_user'],
            'vendor'          => ['required', 'in:mikrotik,cisco,generic,server'],
            'snmp_enabled'    => ['boolean'],
            'snmp_community'  => ['nullable', 'string', 'max:100', 'required_if:snmp_enabled,true'],
            'snmp_version'    => ['in:v1,v2c,v3'],
            'location'        => ['nullable', 'string', 'max:150'],
            'description'     => ['nullable', 'string', 'max:500'],
            'is_active'       => ['boolean'],
            'area_id'         => ['nullable', 'exists:areas,id'],
            'map_x'           => ['nullable', 'numeric'],
            'map_y'           => ['nullable', 'numeric'],
            'icon_file'       => ['nullable', 'image', 'mimes:svg,png,jpg,jpeg', 'max:2048'],
            // Credential fields — stored encrypted as a nested JSON blob.
            // Structure: { mikrotik: { api_user, api_pass, api_port }, cisco: { ssh_user, ssh_pass, enable_pass, ssh_port } }
            'credentials'                    => ['nullable', 'array'],
            // Mikrotik RouterOS API
            'credentials.mikrotik'           => ['nullable', 'array'],
            'credentials.mikrotik.api_user'  => ['nullable', 'string', 'max:100'],
            'credentials.mikrotik.api_pass'  => ['nullable', 'string', 'max:255'],
            'credentials.mikrotik.api_port'  => ['nullable', 'integer', 'min:1', 'max:65535'],
            // Cisco SSH
            'credentials.cisco'              => ['nullable', 'array'],
            'credentials.cisco.ssh_user'     => ['nullable', 'string', 'max:100'],
            'credentials.cisco.ssh_pass'     => ['nullable', 'string', 'max:255'],
            'credentials.cisco.enable_pass'  => ['nullable', 'string', 'max:255'],
            'credentials.cisco.ssh_port'     => ['nullable', 'integer', 'min:1', 'max:65535'],
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
