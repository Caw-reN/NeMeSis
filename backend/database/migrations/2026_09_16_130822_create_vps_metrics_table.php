<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vps_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();

            // CPU (percentage, from UCD-SNMP-MIB)
            $table->float('cpu_user',   5, 2)->nullable()->comment('% CPU user');
            $table->float('cpu_system', 5, 2)->nullable()->comment('% CPU system');
            $table->float('cpu_idle',   5, 2)->nullable()->comment('% CPU idle');

            // RAM (kilobytes, from UCD-SNMP-MIB)
            $table->bigInteger('mem_total_kb')->nullable();
            $table->bigInteger('mem_free_kb')->nullable();
            $table->bigInteger('mem_cached_kb')->nullable();

            // Disk partitions — JSON array: [{name, total_kb, used_kb, type}]
            $table->json('disk_partitions')->nullable();

            // Network interfaces — JSON array: [{name, rx_bytes, tx_bytes, speed}]
            $table->json('net_interfaces')->nullable();

            // System info
            $table->bigInteger('uptime_sec')->nullable();
            $table->string('sys_descr', 500)->nullable()->comment('OS/distro description from sysDescr');
            $table->string('sys_name', 255)->nullable()->comment('Hostname from sysName');

            $table->timestamp('polled_at')->useCurrent();
            $table->timestamps();

            $table->index('device_id');
            $table->index('polled_at');
        });

        // Ensure 'server' is a valid vendor — alter enum on devices table
        // (MySQL ALTER COLUMN for enum)
        \DB::statement("ALTER TABLE devices MODIFY COLUMN vendor ENUM('mikrotik','cisco','generic','server') NOT NULL DEFAULT 'generic'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vps_metrics');
        \DB::statement("ALTER TABLE devices MODIFY COLUMN vendor ENUM('mikrotik','cisco','generic') NOT NULL DEFAULT 'generic'");
    }
};
