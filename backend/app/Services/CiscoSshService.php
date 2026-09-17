<?php

namespace App\Services;

use phpseclib3\Net\SSH2;

/**
 * CiscoSshService — SSH automation for Cisco Catalyst switches
 *
 * Uses phpseclib3 (pure PHP SSH2 implementation, no OS extension needed).
 * Supports read-only operations: interface status, VLAN table, device version.
 *
 * SECURITY: This service only reads data (Read Mode — Fase 3a).
 * Write operations (Enable/Disable port, VLAN assignment) are reserved for Fase 3b.
 */
class CiscoSshService
{
    private ?SSH2 $ssh = null;

    public function __construct(
        private readonly string $host,
        private readonly int    $port    = 22,
        private readonly int    $timeout = 10,
    ) {}

    // =========================================================================
    // Connection
    // =========================================================================

    /**
     * Connect via SSH and optionally enter privileged exec (enable) mode.
     *
     * @throws \RuntimeException on connection or authentication failure
     */
    public function connect(string $username, string $password, string $enablePassword = ''): void
    {
        $this->ssh = new SSH2($this->host, $this->port, $this->timeout);
        $this->ssh->setTimeout($this->timeout); // Ensure read operations also timeout quickly
        
        // Workaround for older Cisco IOS devices (like Cisco-1.25) that have buggy
        // implementations of rsa-sha2-256/512 or modern KEX, which causes them to
        // silently corrupt the crypto state and reject keyboard-interactive auth.
        $this->ssh->setPreferredAlgorithms([
            'kex'     => ['diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1'],
            'hostkey' => ['ssh-rsa', 'ssh-dss'],
            'client_to_server' => [
                'crypt' => ['aes128-ctr', 'aes192-ctr', 'aes256-ctr']
            ],
            'server_to_client' => [
                'crypt' => ['aes128-ctr', 'aes192-ctr', 'aes256-ctr']
            ]
        ]);

        if (!$this->ssh->login($username, $password)) {
            throw new \RuntimeException("SSH login failed for {$this->host}:{$this->port} as user '{$username}'.");
        }

        // Consume the initial login banner and prompt
        $this->ssh->read('/[>#]/', SSH2::READ_REGEX);

        // Disable terminal paging so full output is returned
        $this->ssh->write("terminal length 0\n");
        $prompt = $this->ssh->read('/[>#]/', SSH2::READ_REGEX);

        // Enter privileged exec mode only if enable password is explicitly provided
        if (!empty($enablePassword) && str_ends_with(trim($prompt), '>')) {
            $this->enable($enablePassword);
        }
    }

    private function enable(string $enablePassword): void
    {
        $this->ssh->write("enable\n");
        $out = $this->ssh->read('/([Pp]assword:|% Error|[>#])/i', SSH2::READ_REGEX);
        
        if (str_contains($out, '% Error')) {
            throw new \RuntimeException("Failed to enter enable mode: The switch rejected the enable command (Authentication error). Please ensure an enable secret/password is configured on the Cisco switch.");
        }

        if (stripos($out, 'assword') !== false) {
            $this->ssh->write($enablePassword . "\n");
            $out2 = $this->ssh->read('/([>#]|% Access denied|% Bad secrets)/', SSH2::READ_REGEX);

            if (str_contains($out2, '% Access denied') || str_contains($out2, '% Bad secrets') || !str_ends_with(trim($out2), '#')) {
                throw new \RuntimeException('Failed to enter enable mode: Incorrect enable password.');
            }
        } elseif (str_ends_with(trim($out), '>')) {
            // It didn't ask for a password but returned to >
            throw new \RuntimeException('Failed to enter enable mode. Device returned to user exec mode.');
        }
    }

    public function disconnect(): void
    {
        if ($this->ssh) {
            try {
                $this->ssh->write("exit\n");
            } catch (\Throwable) {
                // Ignore on disconnect
            }
            $this->ssh->disconnect();
            $this->ssh = null;
        }
    }

    // =========================================================================
    // High-level Read Methods
    // =========================================================================

    /**
     * Get device hardware and software version info.
     */
    public function getVersion(): array
    {
        $output = $this->exec('show version');
        return $this->parseVersion($output);
    }

    /**
     * Get interface status table (one row per port, from 'show interfaces status').
     * Best for getting VLAN assignment and link state at a glance.
     */
    public function getInterfaceStatus(): array
    {
        $output = $this->exec('show interfaces status');
        return $this->parseInterfaceStatus($output);
    }

    /**
     * Get detailed interface counters (Rx/Tx bytes and packets).
     * Parsed from 'show interfaces' (full detail output).
     */
    public function getInterfaceDetail(): array
    {
        $output = $this->exec('show interfaces');
        return $this->parseInterfaceDetail($output);
    }

    /**
     * Get VLAN table (ID, name, status, assigned ports).
     */
    public function getVlanBrief(): array
    {
        $output = $this->exec('show vlan brief');
        return $this->parseVlanBrief($output);
    }

    /**
     * Get MAC address table (for network mapping).
     */
    public function getMacAddressTable(): array
    {
        $output = $this->exec('show mac address-table');
        return $this->parseMacTable($output);
    }

    // =========================================================================
    // Fase 4: Auto-Discovery — CDP & LLDP Neighbor Parsing
    // =========================================================================

    /**
     * Pull CDP (Cisco Discovery Protocol) neighbor details.
     * Executes 'show cdp neighbors detail' and parses each neighbor block.
     *
     * @return array<int, array{ip: string, hostname: string, local_iface: string, remote_iface: string, protocol: string}>
     */
    public function getCdpNeighbors(): array
    {
        try {
            $output = $this->exec('show cdp neighbors detail');
        } catch (\Throwable) {
            return []; // CDP might be disabled
        }

        // CDP is disabled globally if output contains 'not enabled' or '%CDP is not enabled'
        if (str_contains($output, 'not enabled') || str_contains($output, 'not running')) {
            return [];
        }

        return $this->parseCdpNeighborsDetail($output);
    }

    /**
     * Pull LLDP neighbor details (fallback when CDP is disabled).
     * Executes 'show lldp neighbors detail'.
     *
     * @return array<int, array{ip: string, hostname: string, local_iface: string, remote_iface: string, protocol: string}>
     */
    public function getLldpNeighbors(): array
    {
        try {
            $output = $this->exec('show lldp neighbors detail');
        } catch (\Throwable) {
            return []; // LLDP might also be disabled
        }

        if (str_contains($output, 'not enabled') || str_contains($output, '% LLDP')) {
            return [];
        }

        return $this->parseLldpNeighborsDetail($output);
    }

    /**
     * Parse 'show cdp neighbors detail' output.
     *
     * CDP block example:
     * -------------------------
     * Device ID: SW-DIST-01
     * Entry address(es):
     *   IP address: 192.168.1.2
     * Platform: cisco WS-C2960-24,  Capabilities: Switch IGMP
     * Interface: GigabitEthernet0/1,  Port ID (outgoing port): GigabitEthernet1/0/1
     *
     * @return array<int, array{ip, hostname, local_iface, remote_iface, protocol}>
     */
    private function parseCdpNeighborsDetail(string $output): array
    {
        $neighbors = [];

        // Split on the separator line between neighbor entries
        $blocks = preg_split('/\n-{5,}\n/', $output);

        foreach ($blocks as $block) {
            $block = trim($block);
            if (empty($block)) {
                continue;
            }

            $neighbor = [
                'ip'           => '',
                'hostname'     => '',
                'local_iface'  => '',
                'remote_iface' => '',
                'protocol'     => 'cdp',
            ];

            // Device hostname (Device ID line)
            if (preg_match('/Device ID:\s*([^\n\r]+)/i', $block, $m)) {
                // Strip domain suffix from hostname (e.g. "SW-DIST-01.company.local" → "SW-DIST-01")
                $neighbor['hostname'] = trim(explode('.', trim($m[1]))[0]);
            }

            // Management / entry IP address — try multiple CDP IP formats
            // Format 1: "  IP address: x.x.x.x"
            // Format 2: "  IPv4 address: x.x.x.x"
            if (preg_match('/(?:IP|IPv4)\s+address:\s*(\d{1,3}(?:\.\d{1,3}){3})/i', $block, $m)) {
                $neighbor['ip'] = trim($m[1]);
            }

            // Local interface (our side): "Interface: GigabitEthernet0/1,"
            if (preg_match('/^Interface:\s*([^,\n]+)/im', $block, $m)) {
                $neighbor['local_iface'] = $this->normalizeInterface(trim($m[1]));
            }

            // Remote interface (their side): "Port ID (outgoing port): GigabitEthernet1/0/1"
            if (preg_match('/Port ID \(outgoing port\):\s*([^\n\r]+)/i', $block, $m)) {
                $neighbor['remote_iface'] = $this->normalizeInterface(trim($m[1]));
            }

            // Only include if we have at least a hostname or IP
            if ($neighbor['hostname'] || $neighbor['ip']) {
                $neighbors[] = $neighbor;
            }
        }

        return $neighbors;
    }

    /**
     * Parse 'show lldp neighbors detail' output.
     *
     * LLDP block example:
     * ------------------------------------------------
     * Local Intf: Gi0/1
     * Chassis id: 00aa.bbcc.ddee
     * Port id: Gi1/0/1
     * Port Description: GigabitEthernet1/0/1
     * System Name: SW-DIST-01
     *
     * Management Addresses:
     *     IP: 192.168.1.2
     *
     * @return array<int, array{ip, hostname, local_iface, remote_iface, protocol}>
     */
    private function parseLldpNeighborsDetail(string $output): array
    {
        $neighbors = [];

        // Split on separator lines
        $blocks = preg_split('/\n-{5,}\n/', $output);

        foreach ($blocks as $block) {
            $block = trim($block);
            if (empty($block)) {
                continue;
            }

            $neighbor = [
                'ip'           => '',
                'hostname'     => '',
                'local_iface'  => '',
                'remote_iface' => '',
                'protocol'     => 'lldp',
            ];

            // Local interface
            if (preg_match('/Local\s+(?:Intf|Interface):\s*(\S+)/i', $block, $m)) {
                $neighbor['local_iface'] = $this->normalizeInterface($m[1]);
            }

            // System name (hostname)
            if (preg_match('/System\s+Name:\s*([^\n\r]+)/i', $block, $m)) {
                $neighbor['hostname'] = trim(explode('.', trim($m[1]))[0]);
            }

            // Remote port (Port Description or Port id)
            if (preg_match('/Port\s+Description:\s*([^\n\r]+)/i', $block, $m)) {
                $neighbor['remote_iface'] = $this->normalizeInterface(trim($m[1]));
            } elseif (preg_match('/Port\s+id:\s*(\S+)/i', $block, $m)) {
                $neighbor['remote_iface'] = $this->normalizeInterface($m[1]);
            }

            // Management IP
            if (preg_match('/(?:IP|IPv4):\s*(\d{1,3}(?:\.\d{1,3}){3})/i', $block, $m)) {
                $neighbor['ip'] = trim($m[1]);
            }

            if ($neighbor['hostname'] || $neighbor['ip']) {
                $neighbors[] = $neighbor;
            }
        }

        return $neighbors;
    }

    /**
     * Normalize interface names to short form.
     * e.g. "GigabitEthernet0/1" → "Gi0/1", "FastEthernet0/1" → "Fa0/1"
     */
    private function normalizeInterface(string $iface): string
    {
        $map = [
            '/GigabitEthernet/i'      => 'Gi',
            '/FastEthernet/i'         => 'Fa',
            '/TenGigabitEthernet/i'   => 'Te',
            '/TwentyFiveGigE/i'       => 'Twe',
            '/HundredGigE/i'          => 'Hu',
            '/mgmt/i'                 => 'mgmt',
        ];

        foreach ($map as $pattern => $replacement) {
            $iface = preg_replace($pattern, $replacement, $iface);
        }

        return trim($iface);
    }


    private function exec(string $command): string
    {
        if (!$this->ssh) {
            throw new \RuntimeException('SSH connection not established.');
        }

        // Ensure the timeout applies to EVERY read operation, not just the connection.
        $this->ssh->setTimeout($this->timeout);

        $this->ssh->write("{$command}\n");
        $output = $this->ssh->read('/[>#]/', SSH2::READ_REGEX);

        if ($output === false) {
            throw new \RuntimeException("Timeout reading output of '{$command}' from {$this->host}.");
        }

        // Strip the command echo and trailing prompt
        $lines = explode("\n", $output);
        // Remove first line (command echo) and last line (prompt)
        $lines = array_slice($lines, 1, -1);
        $result = implode("\n", $lines);

        // Check for common Cisco CLI errors
        if (preg_match('/^\s*% /m', $result)) {
            // Find the line that has the error
            foreach ($lines as $line) {
                if (str_starts_with(trim($line), '%')) {
                    throw new \RuntimeException("Cisco CLI Error on command '{$command}': " . trim($line));
                }
            }
            throw new \RuntimeException("Cisco CLI Error on command '{$command}': " . trim($result));
        }

        return $result;
    }

    // =========================================================================
    // Fase 3b: Remote Configuration (Write Mode)
    // =========================================================================

    /**
     * Assert that the SSH session is in Privileged EXEC mode (#).
     * Throws a clear error if still in User EXEC mode (>).
     */
    private function requirePrivilegedMode(): void
    {
        $this->ssh->write("\n");
        $out = $this->ssh->read('/[>#]/', SSH2::READ_REGEX);
        if (!str_ends_with(trim($out), '#')) {
            throw new \RuntimeException(
                'Akses ditolak: SSH user tidak memiliki Privileged Mode (#). ' .
                'Silakan set privilege 15 di switch: "username teknisi privilege 15 secret <pass>", ' .
                'atau isi field Enable Password di credentials perangkat ini.'
            );
        }
    }

    public function executeTerminalCommand(string $command): string
    {
        return $this->exec($command);
    }

    public function setPortState(string $interfaceName, bool $enable): void
    {
        $this->requirePrivilegedMode();
        $this->exec('configure terminal');
        $this->exec("interface {$interfaceName}");
        if ($enable) {
            $this->exec('no shutdown');
        } else {
            $this->exec('shutdown');
        }
        $this->exec('end');
    }

    public function setPortMode(string $interfaceName, string $mode, ?int $vlanId = null): void
    {
        $this->requirePrivilegedMode();
        $this->exec('configure terminal');
        $this->exec("interface {$interfaceName}");
        
        if ($mode === 'trunk') {
            // Some Cisco switches require encapsulation dot1q before mode trunk, we can try it.
            // Ignore error if it fails (not all switches support it, like SG300).
            try {
                $this->exec('switchport trunk encapsulation dot1q');
            } catch (\Exception $e) {}
            
            $this->exec('switchport mode trunk');
            // Try to clear access vlan so it doesn't show old vlan when disconnected
            $this->exec('no switchport access vlan');
        } else {
            $this->exec('switchport mode access');
            if ($vlanId) {
                $this->exec("switchport access vlan {$vlanId}");
            }
        }
        $this->exec('end');
    }

    public function setPortName(string $interfaceName, string $name): void
    {
        $this->requirePrivilegedMode();
        $this->exec('configure terminal');
        $this->exec("interface {$interfaceName}");
        
        if ($name === '') {
            $this->exec('no description');
        } else {
            $this->exec("description {$name}");
        }
        $this->exec('end');
    }

    public function updatePortConfig(string $interfaceName, string $mode, ?int $vlanId, ?string $name): void
    {
        $this->requirePrivilegedMode();
        $this->exec('configure terminal');
        $this->exec("interface {$interfaceName}");
        
        // Mode & VLAN
        if ($mode === 'trunk') {
            try {
                $this->exec('switchport trunk encapsulation dot1q');
            } catch (\Exception $e) {}
            
            $this->exec('switchport mode trunk');
            $this->exec('no switchport access vlan');
        } else {
            $this->exec('switchport mode access');
            if ($vlanId) {
                $this->exec("switchport access vlan {$vlanId}");
            }
        }

        // Name / Description
        if ($name !== null) {
            if ($name === '') {
                $this->exec('no description');
            } else {
                $this->exec("description {$name}");
            }
        }

        $this->exec('end');
    }

    /**
     * Create a new VLAN on the switch.
     *
     * Cisco IOS commands:
     *   conf t
     *   vlan {id}
     *   name {name}
     *   end
     *   write memory
     */
    public function createVlan(int $vlanId, string $name = ''): void
    {
        $this->requirePrivilegedMode();
        $this->exec('configure terminal');
        $this->exec("vlan {$vlanId}");
        if ($name !== '') {
            $this->exec("name {$name}");
        }
        $this->exec('end');
        // Save to startup-config so the VLAN persists after reboot
        $this->exec('write memory');
    }

    /**
     * Delete a VLAN from the switch.
     *
     * Cisco IOS commands:
     *   conf t
     *   no vlan {id}
     *   end
     *   write memory
     */
    public function deleteVlan(int $vlanId): void
    {
        $this->requirePrivilegedMode();
        $this->exec('configure terminal');
        $this->exec("no vlan {$vlanId}");
        $this->exec('end');
        $this->exec('write memory');
    }

    public function reboot(): void
    {
        // Cisco reboot command is 'reload'
        // We write 'reload' and then might be prompted to save config or confirm.
        $this->ssh->write("reload\n");
        $output = $this->ssh->read('/(Save\? \[yes\/no\]|Proceed with reload\? \[confirm\])/i', SSH2::READ_REGEX);
        
        if (str_contains(strtolower($output), 'save?')) {
            $this->ssh->write("no\n"); // Don't save modified config before reload to be safe
            $this->ssh->read('/Proceed with reload\? \[confirm\]/i', SSH2::READ_REGEX);
        }
        
        $this->ssh->write("\n"); // Confirm
        
        // We expect the connection to drop now.
    }

    // =========================================================================
    // Output Parsers
    // =========================================================================

    private function parseVersion(string $output): array
    {
        $info = [];

        if (preg_match('/Cisco IOS .* Version ([\d\.\(\)A-Za-z]+)/i', $output, $m)) {
            $info['ios_version'] = $m[1];
        }
        if (preg_match('/Cisco ([\w\-]+) .* processor/i', $output, $m)) {
            $info['model'] = $m[1];
        }
        if (preg_match('/uptime is (.+)/i', $output, $m)) {
            $info['uptime'] = trim($m[1]);
        }
        if (preg_match('/(\d+)K bytes of physical memory/i', $output, $m)) {
            $info['memory_kb'] = (int) $m[1];
        }
        if (preg_match('/System serial number\s*:\s*(\S+)/i', $output, $m)) {
            $info['serial'] = $m[1];
        }

        return $info;
    }

    /**
     * Parse 'show interfaces status' output.
     *
     * Example line:
     *   Gi0/1      uplink            connected    1          a-full  a-1000   10/100/1000BaseTX
     */
    private function parseInterfaceStatus(string $output): array
    {
        $interfaces = [];
        $lines = explode("\n", $output);
        $inData = false;

        $pos = [];

        foreach ($lines as $line) {
            $line = rtrim($line);

            // Detect table header and its column positions
            if (preg_match('/^Port\s+Name/', $line)) {
                $inData = true;
                $pos['Name']   = strpos($line, 'Name');
                $pos['Status'] = strpos($line, 'Status');
                $pos['Vlan']   = strpos($line, 'Vlan');
                $pos['Duplex'] = strpos($line, 'Duplex');
                $pos['Speed']  = strpos($line, 'Speed');
                $pos['Type']   = strpos($line, 'Type');
                continue;
            }

            if (!$inData || trim($line) === '' || empty($pos)) {
                continue;
            }

            // Extract fixed-width columns
            $port   = trim(substr($line, 0, $pos['Name']));
            $name   = trim(substr($line, $pos['Name'], $pos['Status'] - $pos['Name']));
            $status = trim(substr($line, $pos['Status'], $pos['Vlan'] - $pos['Status']));
            $vlan   = trim(substr($line, $pos['Vlan'], $pos['Duplex'] - $pos['Vlan']));
            $duplex = trim(substr($line, $pos['Duplex'], $pos['Speed'] - $pos['Duplex']));
            
            // Handle optional 'Type' column at the end
            if ($pos['Type'] !== false && strlen($line) > $pos['Type']) {
                $speed = trim(substr($line, $pos['Speed'], $pos['Type'] - $pos['Speed']));
                $type  = trim(substr($line, $pos['Type']));
            } else {
                $speed = trim(substr($line, $pos['Speed']));
                $type  = '';
            }

            if ($port !== '') {
                $interfaces[] = [
                    'port'   => $port,
                    'name'   => $name,
                    'status' => $status,
                    'vlan'   => $vlan,
                    'duplex' => $duplex,
                    'speed'  => $speed,
                    'type'   => $type,
                ];
            }
        }

        return $interfaces;
    }

    /**
     * Parse 'show interfaces' for Rx/Tx counters.
     * Returns one item per interface with rate and packet counters.
     */
    private function parseInterfaceDetail(string $output): array
    {
        $interfaces = [];

        // Split by interface blocks — each starts with interface name at beginning of line
        $blocks = preg_split('/\n(?=\w)/m', $output);

        foreach ($blocks as $block) {
            if (empty(trim($block))) {
                continue;
            }

            $iface = [];

            // Interface name and link/protocol status
            if (preg_match(
                '/^([\w\/\.]+)\s+is (up|down|administratively down),\s+line protocol is (up|down)/m',
                $block,
                $m
            )) {
                $iface['name']          = $m[1];
                $iface['admin_status']  = $m[2];
                $iface['line_protocol'] = $m[3];
            } else {
                continue; // Skip non-interface blocks
            }

            // Input/Output rates (bits per second)
            if (preg_match('/input rate (\d+) bits\/sec,\s+(\d+) packets\/sec/i', $block, $m)) {
                $iface['input_bps']     = (int) $m[1];
                $iface['input_pps']     = (int) $m[2];
            }
            if (preg_match('/output rate (\d+) bits\/sec,\s+(\d+) packets\/sec/i', $block, $m)) {
                $iface['output_bps']    = (int) $m[1];
                $iface['output_pps']    = (int) $m[2];
            }

            // Total packet counters
            if (preg_match('/(\d+) packets input,\s+(\d+) bytes/i', $block, $m)) {
                $iface['packets_in']    = (int) $m[1];
                $iface['bytes_in']      = (int) $m[2];
            }
            if (preg_match('/(\d+) packets output,\s+(\d+) bytes/i', $block, $m)) {
                $iface['packets_out']   = (int) $m[1];
                $iface['bytes_out']     = (int) $m[2];
            }

            // Errors
            if (preg_match('/(\d+) input errors/i', $block, $m)) {
                $iface['errors_in']     = (int) $m[1];
            }
            if (preg_match('/(\d+) output errors/i', $block, $m)) {
                $iface['errors_out']    = (int) $m[1];
            }

            $interfaces[] = $iface;
        }

        return $interfaces;
    }

    /**
     * Parse 'show vlan brief' output.
     *
     * Example:
     *   1    default          active    Gi0/1, Gi0/2
     *   10   Management       active    Gi0/3
     */
    private function parseVlanBrief(string $output): array
    {
        $vlans  = [];
        $lines  = explode("\n", $output);
        $inData = false;

        foreach ($lines as $line) {
            $line = rtrim($line);

            if (preg_match('/^----/', $line)) {
                $inData = true;
                continue;
            }

            if (!$inData) {
                continue;
            }

            if (trim($line) === '') {
                continue;
            }

            // Data row: VLAN-ID  Name  Status  Ports...
            if (preg_match('/^(\d+)\s+(\S+)\s+(\S+)\s*(.*)/', $line, $m)) {
                $vlans[] = [
                    'vlan_id' => (int) $m[1],
                    'name'    => $m[2],
                    'status'  => $m[3],   // active / act/unsup
                    'ports'   => trim($m[4]),
                ];
            } elseif (!empty($vlans) && preg_match('/^\s{20,}(\S.*)/', $line, $m)) {
                // Continuation line — additional ports
                $last = count($vlans) - 1;
                $vlans[$last]['ports'] .= ', ' . trim($m[1]);
            }
        }

        return $vlans;
    }

    /**
     * Parse 'show mac address-table' into structured records.
     */
    private function parseMacTable(string $output): array
    {
        $entries = [];
        $lines   = explode("\n", $output);

        foreach ($lines as $line) {
            // VLAN  MAC Address  Type  Ports
            if (preg_match('/^\s*(\d+)\s+([\w\.]+)\s+(\w+)\s+(\S+)/', $line, $m)) {
                $entries[] = [
                    'vlan'    => (int) $m[1],
                    'mac'     => $m[2],
                    'type'    => $m[3],   // DYNAMIC / STATIC
                    'port'    => $m[4],
                ];
            }
        }

        return $entries;
    }
}
