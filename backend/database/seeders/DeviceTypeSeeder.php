<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DeviceTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $types = [
            [
                'name'      => 'router',
                'label'     => 'Router',
                'icon_svg'  => '<path d="M5 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"></path><path d="M9 11v-3"></path><path d="M15 11v-3"></path><circle cx="12" cy="16" r="2"></circle>',
                'is_custom' => false,
            ],
            [
                'name'      => 'switch',
                'label'     => 'Switch',
                'icon_svg'  => '<rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path>',
                'is_custom' => false,
            ],
            [
                'name'      => 'server',
                'label'     => 'Server',
                'icon_svg'  => '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"></rect><rect width="20" height="8" x="2" y="14" rx="2" ry="2"></rect><line x1="6" x2="6.01" y1="6" y2="6"></line><line x1="6" x2="6.01" y1="18" y2="18"></line>',
                'is_custom' => false,
            ],
            [
                'name'      => 'ap',
                'label'     => 'Access Point',
                'icon_svg'  => '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"></path>',
                'is_custom' => false,
            ],
            [
                'name'      => 'firewall',
                'label'     => 'Firewall',
                'icon_svg'  => '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>',
                'is_custom' => false,
            ],
            [
                'name'      => 'passive',
                'label'     => 'Passive',
                'icon_svg'  => '<path d="M12 22v-5"></path><path d="M9 8V2"></path><path d="M15 8V2"></path><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"></path>',
                'is_custom' => false,
            ],
            [
                'name'      => 'other',
                'label'     => 'Other',
                'icon_svg'  => '<rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line>',
                'is_custom' => false,
            ],
        ];

        foreach ($types as $type) {
            \App\Models\DeviceType::updateOrCreate(
                ['name' => $type['name']],
                $type
            );
        }
    }
}
