<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;

/**
 * DeviceCredentialService
 *
 * Handles AES-256-CBC encryption and decryption of device credentials.
 *
 * ARCHITECTURAL DECISION (Fase 1):
 * - The Go Worker NEVER touches this service or the encrypted credentials column.
 * - The Go Worker only reads: snmp_community (plaintext, read-only).
 * - This service is exclusively used by Laravel for Remote Config operations (Fase 3+).
 */
class DeviceCredentialService
{
    /**
     * Encrypt a credentials array into a string suitable for DB storage.
     *
     * @param  array  $credentials  e.g., ['password' => '...', 'api_token' => '...', 'ssh_key' => '...']
     */
    public function encrypt(array $credentials): string
    {
        return Crypt::encryptString(json_encode($credentials));
    }

    /**
     * Decrypt a stored credential string back into an array.
     *
     * @param  string  $encrypted  The raw encrypted string from DB
     * @return array|null  Returns null if decryption fails
     */
    public function decrypt(string $encrypted): ?array
    {
        try {
            return json_decode(Crypt::decryptString($encrypted), true);
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * Get a specific credential field from an encrypted string.
     * Useful for Fase 3 Remote Config: get just the SSH password or API token.
     *
     * @param  string  $encrypted  The raw encrypted string from DB
     * @param  string  $field      e.g., 'password', 'api_token', 'ssh_key'
     */
    public function getField(string $encrypted, string $field): ?string
    {
        $credentials = $this->decrypt($encrypted);
        return $credentials[$field] ?? null;
    }
}
