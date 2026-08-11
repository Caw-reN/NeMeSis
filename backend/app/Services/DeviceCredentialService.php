<?php

namespace App\Services;

use App\Models\Device;
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
 *
 * Credential JSON structure stored encrypted in DB:
 * {
 *   "mikrotik": { "api_user": "...", "api_pass": "...", "api_port": 8728 },
 *   "cisco":    { "ssh_user": "...", "ssh_pass": "...", "enable_pass": "...", "ssh_port": 22 }
 * }
 */
class DeviceCredentialService
{
    /**
     * Encrypt a credentials array into a string suitable for DB storage.
     */
    public function encrypt(array $credentials): string
    {
        return Crypt::encryptString(json_encode($credentials));
    }

    /**
     * Decrypt a stored credential string back into an array.
     *
     * @return array|null  Returns null if decryption fails (e.g., key mismatch)
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
     */
    public function getField(string $encrypted, string $field): ?string
    {
        $credentials = $this->decrypt($encrypted);
        return $credentials[$field] ?? null;
    }

    // =========================================================================
    // Fase 3 — Vendor-specific credential accessors
    // =========================================================================

    /**
     * Get Mikrotik RouterOS API credentials from a Device model.
     *
     * Returns structured array or null if credentials are not set/decryptable.
     *
     * @return array{api_user: string, api_pass: string, api_port: int}|null
     */
    public function getMikrotikCredentials(Device $device): ?array
    {
        if (!$device->credentials) {
            return null;
        }

        $all = $this->decrypt($device->credentials);

        if (!$all || empty($all['mikrotik'])) {
            return null;
        }

        $mk = $all['mikrotik'];

        // Validate required fields
        if (empty($mk['api_user']) || empty($mk['api_pass'])) {
            return null;
        }

        return [
            'api_user' => $mk['api_user'],
            'api_pass' => $mk['api_pass'],
            'api_port' => (int) ($mk['api_port'] ?? 8728),
        ];
    }

    /**
     * Get Cisco SSH credentials from a Device model.
     *
     * @return array{ssh_user: string, ssh_pass: string, enable_pass: string, ssh_port: int}|null
     */
    public function getCiscoCredentials(Device $device): ?array
    {
        if (!$device->credentials) {
            return null;
        }

        $all = $this->decrypt($device->credentials);

        if (!$all || empty($all['cisco'])) {
            return null;
        }

        $cisco = $all['cisco'];

        // Validate required fields
        if (empty($cisco['ssh_user']) || empty($cisco['ssh_pass'])) {
            return null;
        }

        return [
            'ssh_user'    => $cisco['ssh_user'],
            'ssh_pass'    => $cisco['ssh_pass'],
            'enable_pass' => $cisco['enable_pass'] ?? '',
            'ssh_port'    => (int) ($cisco['ssh_port'] ?? 22),
        ];
    }

    /**
     * Merge new credentials into existing encrypted blob.
     * Preserves unrelated vendor credentials (e.g., updating Mikrotik won't erase Cisco).
     */
    public function mergeAndEncrypt(?string $existingEncrypted, array $newCredentials): string
    {
        $existing = [];

        if ($existingEncrypted) {
            $existing = $this->decrypt($existingEncrypted) ?? [];
        }

        $merged = array_merge($existing, $newCredentials);

        return $this->encrypt($merged);
    }
}
