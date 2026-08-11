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

        if (!$this->ssh->login($username, $password)) {
            throw new \RuntimeException("SSH login failed for {$this->host}:{$this->port} as user '{$username}'.");
        }

        // Disable terminal paging so full output is returned
        $this->ssh->write("terminal length 0\n");
        $this->ssh->read('/[>#]/');

        // Enter privileged exec mode if enable password is provided
        if (!empty($enablePassword)) {
            $this->enable($enablePassword);
        }
    }

    private function enable(string $enablePassword): void
    {
        $this->ssh->write("enable\n");
        $output = $this->ssh->read('/Password:|[>#]/');

        if (str_contains($output, 'Password:')) {
            $this->ssh->write("{$enablePassword}\n");
            $result = $this->ssh->read('/[>#]/');

            if (!str_contains($result, '#')) {
                throw new \RuntimeException('Failed to enter enable mode — check enable password.');
            }
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
    // Raw Exec Helper
    // =========================================================================

    private function exec(string $command): string
    {
        if (!$this->ssh) {
            throw new \RuntimeException('SSH not connected. Call connect() first.');
        }

        $this->ssh->write("{$command}\n");
        // Read until we see a prompt (# for privileged, > for user mode)
        $output = $this->ssh->read('/[>#]/');

        // Strip the command echo and trailing prompt
        $lines = explode("\n", $output);
        // Remove first line (command echo) and last line (prompt)
        $lines = array_slice($lines, 1, -1);
        return implode("\n", $lines);
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

        foreach ($lines as $line) {
            $line = rtrim($line);

            // Detect table header
            if (preg_match('/^Port\s+Name/', $line)) {
                $inData = true;
                continue;
            }

            if (!$inData || trim($line) === '') {
                continue;
            }

            // Port Name Status Vlan Duplex Speed Type
            // Use fixed-width-aware regex (columns are space-delimited but name can have spaces)
            if (preg_match(
                '/^(\S+)\s+(.*?)\s{2,}(\w+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/',
                $line,
                $m
            )) {
                $interfaces[] = [
                    'port'   => $m[1],
                    'name'   => trim($m[2]),
                    'status' => $m[3],   // connected / notconnect / err-disabled
                    'vlan'   => $m[4],   // vlan number or 'trunk' / 'routed'
                    'duplex' => $m[5],
                    'speed'  => $m[6],
                    'type'   => trim($m[7]),
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
