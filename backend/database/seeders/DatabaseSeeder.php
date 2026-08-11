<?php

namespace Database\Seeders;

use App\Models\Device;
use App\Models\TopologyLink;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // -----------------------------------------------------------------------
        // Admin User
        // -----------------------------------------------------------------------
        $admin = User::firstOrCreate(
            ['email' => 'admin@nms.local'],
            [
                'name'     => 'NMS Administrator',
                'password' => Hash::make('password'),
            ]
        );

        // -----------------------------------------------------------------------
        // Sample Devices (sesuai struktur jaringan umum)
        // -----------------------------------------------------------------------
        $coreRouter = Device::firstOrCreate(
            ['ip_address' => '192.168.1.1'],
            [
                'name'           => 'Core-Router-MKT',
                'type'           => 'router',
                'vendor'         => 'mikrotik',
                'status'         => 'unknown',
                'snmp_enabled'   => true,
                'snmp_community' => 'public',
                'snmp_version'   => 'v2c',
                'location'       => 'Server Room - Rack 1',
                'description'    => 'Mikrotik RB1100AHx4 - Core Router utama',
                'is_active'      => true,
            ]
        );

        $distSwitch1 = Device::firstOrCreate(
            ['ip_address' => '192.168.1.2'],
            [
                'name'           => 'Dist-Switch-Cisco-1',
                'type'           => 'switch',
                'vendor'         => 'cisco',
                'status'         => 'unknown',
                'snmp_enabled'   => true,
                'snmp_community' => 'public',
                'snmp_version'   => 'v2c',
                'location'       => 'Server Room - Rack 2',
                'description'    => 'Cisco Catalyst 2960 - Distribution Switch',
                'is_active'      => true,
            ]
        );

        $distSwitch2 = Device::firstOrCreate(
            ['ip_address' => '192.168.1.3'],
            [
                'name'           => 'Dist-Switch-Cisco-2',
                'type'           => 'switch',
                'vendor'         => 'cisco',
                'status'         => 'unknown',
                'snmp_enabled'   => true,
                'snmp_community' => 'public',
                'snmp_version'   => 'v2c',
                'location'       => 'Floor 2 - IDF',
                'description'    => 'Cisco Catalyst 2960 - Distribution Switch Lantai 2',
                'is_active'      => true,
            ]
        );

        $accessSwitch = Device::firstOrCreate(
            ['ip_address' => '192.168.1.10'],
            [
                'name'        => 'Access-Switch-Unmanaged-1',
                'type'        => 'switch',
                'vendor'      => 'generic',
                'status'      => 'unknown',
                'snmp_enabled'=> false,
                'location'    => 'Floor 1 - Meeting Room',
                'description' => 'Unmanaged switch — ditambahkan manual ke topologi',
                'is_active'   => true,
            ]
        );

        $webServer = Device::firstOrCreate(
            ['ip_address' => '192.168.1.100'],
            [
                'name'        => 'Web-Server-Linux',
                'type'        => 'server',
                'vendor'      => 'generic',
                'status'      => 'unknown',
                'snmp_enabled'=> false,
                'location'    => 'Server Room - Rack 3',
                'description' => 'Ubuntu 22.04 LTS Web Server',
                'is_active'   => true,
            ]
        );

        // -----------------------------------------------------------------------
        // Sample Topology Links
        // -----------------------------------------------------------------------
        TopologyLink::firstOrCreate(
            ['source_device_id' => $coreRouter->id, 'target_device_id' => $distSwitch1->id],
            ['link_type' => 'physical', 'label' => 'Trunk', 'source_interface' => 'ether1', 'target_interface' => 'Gi0/1']
        );

        TopologyLink::firstOrCreate(
            ['source_device_id' => $coreRouter->id, 'target_device_id' => $distSwitch2->id],
            ['link_type' => 'physical', 'label' => 'Trunk', 'source_interface' => 'ether2', 'target_interface' => 'Gi0/1']
        );

        TopologyLink::firstOrCreate(
            ['source_device_id' => $distSwitch1->id, 'target_device_id' => $accessSwitch->id],
            ['link_type' => 'manual', 'label' => 'Access']
        );

        TopologyLink::firstOrCreate(
            ['source_device_id' => $distSwitch1->id, 'target_device_id' => $webServer->id],
            ['link_type' => 'physical', 'label' => 'Access', 'source_interface' => 'Fa0/24', 'target_interface' => 'eth0']
        );

        $this->command->info('✅ Seeder selesai: 1 admin user, 5 devices, 4 topology links.');
    }
}
