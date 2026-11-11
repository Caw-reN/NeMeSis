package pinger

import (
	"fmt"
	"time"

	probing "github.com/go-ping/ping"
)

// Result holds the detailed statistics of a ping execution.
type Result struct {
	Target      string
	Alive       bool
	PacketsSent int
	PacketsRecv int
	PacketLoss  float64
	MinRtt      float64 // in ms
	AvgRtt      float64 // in ms
	MaxRtt      float64 // in ms
	StdDevRtt   float64 // in ms
	Error       error
}

// Ping executes an ICMP ping to the target host or IP address.
func Ping(target string, count int, timeout time.Duration) Result {
	if count <= 0 {
		count = 4
	}
	if timeout <= 0 {
		timeout = 4 * time.Second
	}

	pinger, err := probing.NewPinger(target)
	if err != nil {
		return Result{
			Target: target,
			Alive:  false,
			Error:  fmt.Errorf("invalid target: %w", err),
		}
	}

	// Try privileged ICMP first (standard inside Linux Docker container with NET_RAW cap)
	pinger.SetPrivileged(true)
	pinger.Count = count
	pinger.Timeout = timeout
	pinger.Interval = 250 * time.Millisecond

	err = pinger.Run()
	if err != nil {
		// Fallback to unprivileged mode if privileged fails (e.g. non-root on Windows/Linux)
		pinger2, err2 := probing.NewPinger(target)
		if err2 == nil {
			pinger2.SetPrivileged(false)
			pinger2.Count = count
			pinger2.Timeout = timeout
			pinger2.Interval = 250 * time.Millisecond
			if err2 = pinger2.Run(); err2 == nil {
				pinger = pinger2
				err = nil
			}
		}
	}

	if err != nil {
		return Result{
			Target: target,
			Alive:  false,
			Error:  err,
		}
	}

	stats := pinger.Statistics()
	alive := stats.PacketsRecv > 0

	minMs := float64(stats.MinRtt.Microseconds()) / 1000.0
	avgMs := float64(stats.AvgRtt.Microseconds()) / 1000.0
	maxMs := float64(stats.MaxRtt.Microseconds()) / 1000.0
	stdDevMs := float64(stats.StdDevRtt.Microseconds()) / 1000.0

	return Result{
		Target:      target,
		Alive:       alive,
		PacketsSent: stats.PacketsSent,
		PacketsRecv: stats.PacketsRecv,
		PacketLoss:  stats.PacketLoss,
		MinRtt:      minMs,
		AvgRtt:      avgMs,
		MaxRtt:      maxMs,
		StdDevRtt:   stdDevMs,
	}
}

