package scanner

import (
	"fmt"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

// Job represents a single device scan task dispatched to the pool.
type Job struct {
	Device database.DeviceRecord
}

// Result holds the scan outcome for a single device.
type Result struct {
	Device    database.DeviceRecord
	PingOK    bool
	LatencyMs float64
	PingError error
}

// RunPool executes ping scans for all devices in parallel using a goroutine pool.
// poolSize controls the max number of concurrent scanners.
func RunPool(devices []database.DeviceRecord, poolSize int) []Result {
	if len(devices) == 0 {
		return nil
	}

	jobs    := make(chan Job, len(devices))
	results := make(chan Result, len(devices))

	// Start worker goroutines
	for i := 0; i < poolSize; i++ {
		go worker(jobs, results)
	}

	// Enqueue all jobs
	for _, d := range devices {
		jobs <- Job{Device: d}
	}
	close(jobs)

	// Collect all results
	collected := make([]Result, 0, len(devices))
	for i := 0; i < len(devices); i++ {
		collected = append(collected, <-results)
	}

	return collected
}

// worker is a goroutine that processes scan jobs from the jobs channel.
func worker(jobs <-chan Job, results chan<- Result) {
	for job := range jobs {
		ping := PingDevice(job.Device.IPAddress)
		results <- Result{
			Device:    job.Device,
			PingOK:    ping.Alive,
			LatencyMs: ping.LatencyMs,
			PingError: ping.Error,
		}
	}
}

// ProcessResults writes scan results back to the database and logs status changes.
func ProcessResults(results []Result) {
	for _, r := range results {
		newStatus := "down"
		if r.PingOK {
			newStatus = "up"
		}

		var seenAt *time.Time
		var latency float64

		if r.PingOK {
			t := time.Now()
			seenAt = &t
			latency = r.LatencyMs
		}

		// Update device status in DB
		if err := database.UpdateDeviceStatus(r.Device.ID, newStatus, latency, seenAt); err != nil {
			logger.Errorf("Failed to update status for device %s: %v", r.Device.IPAddress, err)
			continue
		}

		// Log status change only if status actually changed
		if newStatus != r.Device.CurrentStatus {
			logStatusChange(r, newStatus)
		}

		if r.PingOK {
			logger.Infof("✅ %s (%s) — UP | %.2fms", r.Device.Name, r.Device.IPAddress, r.LatencyMs)
		} else {
			if r.PingError != nil {
				logger.Warnf("❌ %s (%s) — DOWN | Error: %v", r.Device.Name, r.Device.IPAddress, r.PingError)
			} else {
				logger.Warnf("❌ %s (%s) — DOWN | No reply", r.Device.Name, r.Device.IPAddress)
			}
		}
	}
}

func logStatusChange(r Result, newStatus string) {
	metadata := fmt.Sprintf(
		`{"before": "%s", "after": "%s", "latency_ms": %.2f}`,
		r.Device.CurrentStatus, newStatus, r.LatencyMs,
	)

	msg := fmt.Sprintf(
		"Status berubah: %s → %s untuk device %s (%s)",
		r.Device.CurrentStatus, newStatus, r.Device.Name, r.Device.IPAddress,
	)

	if err := database.InsertDeviceLog(r.Device.ID, "status_change", msg, &metadata); err != nil {
		logger.Errorf("Failed to insert status change log for device %d: %v", r.Device.ID, err)
	}
}
