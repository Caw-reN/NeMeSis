package scanner

import (
	"fmt"
	"net"
	"time"

	probing "github.com/go-ping/ping"
)

// PingResult holds the outcome of a single ping attempt.
type PingResult struct {
	Alive     bool
	LatencyMs float64
	Error     error
}

// PingDevice sends 3 ICMP echo requests to the target IP.
// Returns alive=true with average latency if any reply is received.
//
// NOTE: In Docker, ICMP requires the container to run with:
//   - NET_RAW capability, OR
//   - privileged: true in docker-compose.yml
//
// Alternatively, go-ping supports unprivileged mode on Linux via SOCK_DGRAM.
func PingDevice(ip string) PingResult {
	pinger, err := probing.NewPinger(ip)
	if err != nil {
		return PingResult{Error: fmt.Errorf("failed to create pinger for %s: %w", ip, err)}
	}

	// Use privileged ICMP (raw sockets) — required inside Docker with NET_RAW cap
	pinger.SetPrivileged(true)
	pinger.Count = 3
	pinger.Timeout = 3 * time.Second
	pinger.Interval = 500 * time.Millisecond

	if err := pinger.Run(); err != nil {
		return PingResult{
			Alive: false,
			Error: fmt.Errorf("ping run error for %s: %w", ip, err),
		}
	}

	stats := pinger.Statistics()
	if stats.PacketsRecv == 0 {
		return PingResult{Alive: false}
	}

	return PingResult{
		Alive:     true,
		LatencyMs: float64(stats.AvgRtt.Microseconds()) / 1000.0,
	}
}

// TCPPortCheck checks if a specific TCP port is open on the target IP.
func TCPPortCheck(ip string, port int) (open bool, serviceName string) {
	addr := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		return false, ""
	}
	conn.Close()
	return true, knownTCPServices[port]
}

// knownTCPServices maps common port numbers to service names.
var knownTCPServices = map[int]string{
	21:   "ftp",
	22:   "ssh",
	23:   "telnet",
	25:   "smtp",
	53:   "dns",
	80:   "http",
	443:  "https",
	161:  "snmp",
	3306: "mysql",
	8291: "winbox",
	8728: "mikrotik-api",
	8729: "mikrotik-api-ssl",
}
