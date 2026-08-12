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
        Schema::table('topology_links', function (Blueprint $table) {
            $table->string('cable_type')->default('ethernet')->after('link_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('topology_links', function (Blueprint $table) {
            $table->dropColumn('cable_type');
        });
    }
};
