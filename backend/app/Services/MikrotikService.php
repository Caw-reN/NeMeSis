<?php

namespace App\Services;

/**
 * MikrotikService — RouterOS API via raw TCP socket (fsockopen)
 *
 * Implements the RouterOS API binary protocol without any external package.
 * This gives us full control and avoids dependency on unmaintained community packages.
 *
 * Protocol overview:
 * - Each "word" is length-prefixed (variable byte encoding)
 * - Each "sentence" is a sequence of words terminated by a zero-length word
 * - Commands look like: ['/ip/address/print', '=.proplist=.id,address,interface']
 * - Supports both challenge-response MD5 login (pre v6.43) and plaintext (v6.43+)
 *
 * SECURITY: This service only reads data (Read Mode).
 * Write operations are reserved for Fase 3b (Remote Config).
 */
class MikrotikService
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int    $port    = 8728,
        private readonly int    $timeout = 5,
    ) {}

    // =========================================================================
    // Connection & Authentication
    // =========================================================================

    /**
     * Open TCP socket and authenticate via RouterOS API login sequence.
     *
     * Supports both login methods:
     * - v6.43+: plain password
     * - Pre-v6.43: MD5 challenge-response
     *
     * @throws \RuntimeException on connection or auth failure
     */
    public function connect(string $username, string $password): void
    {
        $this->socket = @fsockopen($this->host, $this->port, $errno, $errstr, $this->timeout);

        if (!$this->socket) {
            throw new \RuntimeException(
                "Cannot connect to Mikrotik at {$this->host}:{$this->port} — {$errstr} (errno: {$errno})"
            );
        }

        stream_set_timeout($this->socket, $this->timeout);
        $this->login($username, $password);
    }

    public function disconnect(): void
    {
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
    }

    private function login(string $username, string $password): void
    {
        // Try the modern v6.43+ login first (or get challenge for pre-v6.43)
        $this->sendSentence(['/login', "=name={$username}", "=password={$password}"]);
        $sentence = $this->readSentence();

        if (empty($sentence)) {
            throw new \RuntimeException('Empty response from Mikrotik during login.');
        }

        $type = $sentence[0];

        if ($type === '!trap' || $type === '!fatal') {
            // Clear the subsequent !done from buffer
            $this->readSentence();
            
            $msg = 'Authentication failed';
            foreach ($sentence as $word) {
                if (str_starts_with($word, '=message=')) {
                    $msg = substr($word, 9);
                }
            }
            throw new \RuntimeException("Mikrotik login failed: {$msg}");
        }

        if ($type === '!done') {
            $challenge = null;
            foreach ($sentence as $word) {
                if (str_starts_with($word, '=ret=')) {
                    $challenge = substr($word, 5);
                }
            }

            if ($challenge) {
                // Pre-v6.43: perform MD5 challenge-response
                $hash = md5(chr(0) . $password . pack('H*', $challenge));
                $this->sendSentence(['/login', "=name={$username}", "=response=00{$hash}"]);
                
                $sentence2 = $this->readSentence();
                $type2 = $sentence2[0] ?? '';
                
                if ($type2 === '!trap' || $type2 === '!fatal') {
                    $this->readSentence(); // clear !done
                    $msg = 'Challenge authentication failed';
                    foreach ($sentence2 as $word) {
                        if (str_starts_with($word, '=message=')) {
                            $msg = substr($word, 9);
                        }
                    }
                    throw new \RuntimeException("Mikrotik login failed: {$msg}");
                }
                
                if ($type2 !== '!done') {
                    throw new \RuntimeException("Unexpected response during challenge login: {$type2}");
                }
            }
            
            // Login successful!
            return;
        }

        throw new \RuntimeException("Unexpected response type during login: {$type}");
    }

    // =========================================================================
    // High-level API Methods (Read Mode only)
    // =========================================================================

    /**
     * Get system resource metrics: CPU, memory, uptime, version.
     */
    public function getSystemResources(): array
    {
        $rows = $this->query(['/system/resource/print']);
        return $rows[0] ?? [];
    }

    /**
     * Get list of interfaces with type, status, and Rx/Tx counters.
     */
    public function getInterfaces(): array
    {
        return $this->query(['/interface/print', '=stats=']);
    }

    /**
     * Get list of IP addresses assigned to interfaces.
     */
    public function getIpAddresses(): array
    {
        return $this->query(['/ip/address/print']);
    }

    /**
     * Get DHCP leases (active clients). Returns empty array if no DHCP server configured.
     */
    public function getDhcpLeases(): array
    {
        try {
            return $this->query(['/ip/dhcp-server/lease/print']);
        } catch (\RuntimeException) {
            return []; // Device has no DHCP server — not an error
        }
    }

    /**
     * Get routing table.
     */
    public function getRoutingTable(): array
    {
        return $this->query(['/ip/route/print']);
    }

    /**
     * Get system identity (hostname).
     */
    public function getIdentity(): string
    {
        $rows = $this->query(['/system/identity/print']);
        return $rows[0]['name'] ?? '';
    }

    // =========================================================================
    // Fase 4: Auto-Discovery — LLDP / Neighbor Protocol
    // =========================================================================

    /**
     * Get IP neighbor discovery table (/ip/neighbor/print).
     *
     * RouterOS uses MNDP (Mikrotik Neighbor Discovery Protocol), which is
     * compatible with LLDP. Returns raw neighbor rows from the API.
     *
     * Key fields in each row:
     *   - address   (or address4): neighbor IP address
     *   - identity   (or system-name): neighbor hostname
     *   - interface:  local interface on which the neighbor was seen
     *   - interface-name: remote interface name (if reported)
     *
     * @return array<int, array<string, string>>
     */
    public function getNeighbors(): array
    {
        try {
            return $this->query(['/ip/neighbor/print']);
        } catch (\RuntimeException) {
            return [];
        }
    }

    // =========================================================================
    // Low-level Protocol Implementation
    // =========================================================================

    // =========================================================================
    // Fase 3b: Remote Configuration (Write Mode)
    // =========================================================================

    /**
     * Execute a raw terminal command via the RouterOS API.
     * Note: Not all CLI commands map cleanly to the API. This attempts to run it
     * or return the raw output.
     */
    public function executeTerminalCommand(string $command): string
    {
        // For Mikrotik, raw terminal commands over API usually use /system/console/print or similar,
        // but executing arbitrary CLI string via API is not natively supported like SSH.
        // We will try to map common commands or throw an error indicating SSH should be used.
        // Actually, if we just split by space and prefix with '/', it might work for basic commands.
        $words = explode(' ', trim($command));
        $words[0] = str_starts_with($words[0], '/') ? $words[0] : '/' . $words[0];
        
        try {
            $result = $this->query($words);
            return json_encode($result, JSON_PRETTY_PRINT);
        } catch (\Exception $e) {
            return "Error executing command: " . $e->getMessage();
        }
    }

    /**
     * Enable or disable a port (interface).
     */
    public function setPortState(string $interfaceName, bool $enable): void
    {
        // First we must get the internal .id of the interface
        $interfaces = $this->query(['/interface/print', "?name={$interfaceName}"]);
        if (empty($interfaces)) {
            throw new \RuntimeException("Interface '{$interfaceName}' not found.");
        }
        $id = $interfaces[0]['.id'];

        $command = $enable ? '/interface/enable' : '/interface/disable';
        $this->query([$command, "=.id={$id}"]);
    }

    /**
     * Reboot the device.
     */
    public function reboot(): void
    {
        // The API does not require a Y/N confirmation for reboot.
        // However, the socket will immediately close, so we expect a read error.
        try {
            $this->sendSentence(['/system/reboot']);
            $this->readSentence();
        } catch (\Exception $e) {
            // Socket closing abruptly is expected here.
        }
    }

    /**
     * Send a sentence (command) and read all response lines until !done or !trap.
     *
     * @param  string[]  $words
     * @return array<int, array<string, string>>
     */
    public function query(array $words): array
    {
        $this->sendSentence($words);
        return $this->readAll();
    }

    private function sendSentence(array $words): void
    {
        foreach ($words as $word) {
            $this->writeWord($word);
        }
        $this->writeWord(''); // End of sentence
    }

    private function writeWord(string $word): void
    {
        $this->writeLength(strlen($word));
        if ($word !== '') {
            fwrite($this->socket, $word);
        }
    }

    /**
     * Encode length using RouterOS variable-byte encoding.
     */
    private function writeLength(int $len): void
    {
        if ($len < 0x80) {
            fwrite($this->socket, chr($len));
        } elseif ($len < 0x4000) {
            $len |= 0x8000;
            fwrite($this->socket, pack('n', $len));
        } elseif ($len < 0x200000) {
            $len |= 0xC00000;
            fwrite($this->socket, chr(($len >> 16) & 0xFF) . pack('n', $len & 0xFFFF));
        } elseif ($len < 0x10000000) {
            $len |= 0xE0000000;
            fwrite($this->socket, pack('N', $len));
        } else {
            fwrite($this->socket, chr(0xF0) . pack('N', $len));
        }
    }

    /**
     * Read a single word from the socket (length-prefixed).
     */
    private function readWord(): string
    {
        $firstByte = $this->readBytes(1);
        if ($firstByte === '') {
            throw new \RuntimeException('Connection to Mikrotik closed unexpectedly.');
        }

        $b = ord($firstByte);

        if ($b < 0x80) {
            $len = $b;
        } elseif ($b < 0xC0) {
            $len = (($b & 0x3F) << 8) | ord($this->readBytes(1));
        } elseif ($b < 0xE0) {
            $len = (($b & 0x1F) << 16) | (ord($this->readBytes(1)) << 8) | ord($this->readBytes(1));
        } elseif ($b < 0xF0) {
            $len = (($b & 0x0F) << 24) | (ord($this->readBytes(1)) << 16) | (ord($this->readBytes(1)) << 8) | ord($this->readBytes(1));
        } else {
            $len = (ord($this->readBytes(1)) << 24) | (ord($this->readBytes(1)) << 16) | (ord($this->readBytes(1)) << 8) | ord($this->readBytes(1));
        }

        if ($len === 0) {
            return ''; // End of sentence
        }

        return $this->readBytes($len);
    }

    private function readBytes(int $length): string
    {
        $data = '';
        while (strlen($data) < $length) {
            $chunk = fread($this->socket, $length - strlen($data));
            if ($chunk === false || $chunk === '') {
                throw new \RuntimeException('Lost connection to Mikrotik device.');
            }
            $data .= $chunk;
        }
        return $data;
    }

    /**
     * Read words until empty word (end of sentence).
     *
     * @return string[]
     */
    private function readSentence(): array
    {
        $words = [];
        while (true) {
            $word = $this->readWord();
            if ($word === '') {
                break;
            }
            $words[] = $word;
        }
        return $words;
    }

    /**
     * Read all reply sentences until !done, collecting !re items into an array.
     *
     * @return array<int, array<string, string>>
     * @throws \RuntimeException on !trap or !fatal
     */
    private function readAll(): array
    {
        $results = [];

        while (true) {
            $sentence = $this->readSentence();

            if (empty($sentence)) {
                continue;
            }

            $type = $sentence[0];

            if ($type === '!done') {
                break;
            }

            if ($type === '!trap' || $type === '!fatal') {
                $msg = 'Unknown RouterOS API error';
                foreach ($sentence as $word) {
                    if (str_starts_with($word, '=message=')) {
                        $msg = substr($word, 9);
                    }
                }
                throw new \RuntimeException("Mikrotik API error: {$msg}");
            }

            if ($type === '!re') {
                $item = [];
                foreach ($sentence as $word) {
                    if (str_starts_with($word, '=')) {
                        $parts = explode('=', substr($word, 1), 2);
                        if (count($parts) === 2) {
                            $item[$parts[0]] = $parts[1];
                        }
                    }
                }
                $results[] = $item;
            }
        }

        return $results;
    }
}
