<?php
require 'vendor/autoload.php';
$client = new \GuzzleHttp\Client();
try {
    $login = $client->post('http://localhost:8000/api/auth/login', [
        'json' => ['email' => 'admin@admin.com', 'password' => 'password']
    ]);
    $token = json_decode((string)$login->getBody(), true)['token'];
    echo "Got token.\n";
    $time = microtime(true);
    $response = $client->post('http://localhost:8000/api/topology/discover', [
        'headers' => ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'],
        'json' => ['ip_ranges' => ['192.168.3.0/24']],
        'timeout' => 120
    ]);
    echo "Finished in " . round(microtime(true) - $time, 2) . "s\n";
    echo $response->getBody();
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
