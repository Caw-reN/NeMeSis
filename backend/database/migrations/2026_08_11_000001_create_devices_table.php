<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('ip_address', 45)->unique();
            $table->enum('type', ['router', 'switch', 'server', 'ap', 'firewall', 'other'])->default('other');
            $table->enum('vendor', ['mikrotik', 'cisco', 'generic'])->default('generic');
            $table->enum('status', ['up', 'down', 'unknown'])->default('unknown');
            $table->boolean('snmp_enabled')->default(false);
            $table->string('snmp_community', 100)->nullable();
            $table->enum('snmp_version', ['v1', 'v2c', 'v3'])->default('v2c');
            $table->text('credentials')->nullable()->comment('AES-256 encrypted JSON: {password, api_token, ssh_key}');
            $table->string('location')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_seen_at')->nullable();
            $table->float('latency_ms', 8, 3)->nullable()->comment('Last ping latency in milliseconds');
            $table->timestamps();

            $table->index(['status', 'is_active']);
            $table->index('ip_address');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
