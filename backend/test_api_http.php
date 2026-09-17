<?php
require __DIR__ . '/vendor/autoload.php';

$client = new \GuzzleHttp\Client();
try {
    echo "Sending request to localhost:8000...\n";
    $time = microtime(true);
    // Send request without Bearer token to see if it hangs or returns 401 immediately
    // Wait, let's login first to get a token!
    
    // 1. Login
    $login = $client->post('http://localhost:8000/api/auth/login', [
        'json' => ['username' => 'admin', 'password' => 'admin123']
    ]);
    $token = json_decode($login->getBody(), true)['token'];
    
    echo "Got token, sending discovery request...\n";
    
    $response = $client->post('http://localhost:8000/api/topology/discover', [
        'headers' => ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'],
        'json' => ['ip_ranges' => ['192.168.111.250-192.168.111.253']],
        'timeout' => 120
    ]);
    
    echo "Finished in " . round(microtime(true) - $time, 2) . "s\n";
    echo $response->getBody() . "\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
