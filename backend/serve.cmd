@echo off
REM Jalankan Laravel backend dengan 4 worker process (bisa handle request bersamaan)
REM Solusi untuk masalah single-threaded php artisan serve yang bisa "macet"
REM ketika request SSH ke Cisco device sedang berjalan.

set PHP_CLI_SERVER_WORKERS=4
php artisan serve --host=127.0.0.1 --port=8000
