<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Alter type ENUM to include 'passive'
        DB::statement("ALTER TABLE devices MODIFY COLUMN type ENUM('router', 'switch', 'server', 'ap', 'firewall', 'other', 'passive') DEFAULT 'other'");
        
        // Make ip_address nullable
        DB::statement("ALTER TABLE devices MODIFY COLUMN ip_address VARCHAR(45) NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: Removing an enum value that is in use can cause errors, so we leave it or change back carefully
        DB::statement("ALTER TABLE devices MODIFY COLUMN ip_address VARCHAR(45) NOT NULL");
        DB::statement("ALTER TABLE devices MODIFY COLUMN type ENUM('router', 'switch', 'server', 'ap', 'firewall', 'other') DEFAULT 'other'");
    }
};
