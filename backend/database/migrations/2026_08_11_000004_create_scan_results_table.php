<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scan_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();
            $table->unsignedSmallInteger('port');
            $table->enum('protocol', ['tcp', 'udp'])->default('tcp');
            $table->enum('state', ['open', 'closed', 'filtered'])->default('filtered');
            $table->string('service_name', 50)->nullable()->comment('e.g., http, ssh, telnet, snmp');
            $table->boolean('is_dangerous')->default(false)->comment('Flagged if sensitive port is open (e.g., Telnet 23)');
            $table->timestamp('scanned_at');
            $table->timestamps();

            // One row per device+port+protocol combination
            $table->unique(['device_id', 'port', 'protocol']);
            $table->index(['device_id', 'state']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scan_results');
    }
};
