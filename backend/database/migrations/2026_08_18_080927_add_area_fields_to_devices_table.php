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
        Schema::table('devices', function (Blueprint $table) {
            $table->foreignId('area_id')->nullable()->constrained('areas')->nullOnDelete();
            $table->float('map_x', 10, 2)->nullable();
            $table->float('map_y', 10, 2)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('devices', function (Blueprint $table) {
            $table->dropForeign(['area_id']);
            $table->dropColumn(['area_id', 'map_x', 'map_y']);
        });
    }
};
