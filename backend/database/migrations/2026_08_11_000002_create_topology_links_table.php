<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('topology_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_device_id')->constrained('devices')->cascadeOnDelete();
            $table->foreignId('target_device_id')->constrained('devices')->cascadeOnDelete();
            $table->enum('link_type', ['physical', 'logical', 'manual'])->default('manual');
            $table->string('label')->nullable()->comment('e.g., Trunk, Access, Uplink');
            $table->string('source_interface')->nullable()->comment('e.g., GigabitEthernet0/1');
            $table->string('target_interface')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Prevent duplicate links in the same direction
            $table->unique(['source_device_id', 'target_device_id']);
            $table->index('source_device_id');
            $table->index('target_device_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('topology_links');
    }
};
