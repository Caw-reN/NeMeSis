package main

import (
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/config"
	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/internal/notifier"
	"github.com/Caw-reN/NeMeSis/worker/internal/scanner"
	"github.com/Caw-reN/NeMeSis/worker/internal/snmp"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

func main() {
	logger.Info("========================================")
	logger.Info("  NMS Worker — Network Scanning Engine  ")
	logger.Info("========================================")

	// -------------------------------------------------------------------------
	// 1. Load Configuration
	// -------------------------------------------------------------------------
	cfg, err := config.Load()
	if err != nil {
		logger.Errorf("Failed to load config: %v", err)
		os.Exit(1)
	}
	logger.Infof("Config loaded | Poll interval: %ds | Pool size: %d",
		cfg.PollIntervalSeconds, cfg.WorkerPoolSize)

	// -------------------------------------------------------------------------
	// 2. Connect to Database
	// -------------------------------------------------------------------------
	if err := database.Connect(cfg); err != nil {
		logger.Errorf("Database connection failed: %v", err)
		os.Exit(1)
	}
	defer database.Close()

	// -------------------------------------------------------------------------
	// 3. Setup graceful shutdown (SIGINT, SIGTERM)
	// -------------------------------------------------------------------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// -------------------------------------------------------------------------
	// 4. Start Telegram Bot Listener
	// -------------------------------------------------------------------------
	go notifier.StartBotListener()

	// -------------------------------------------------------------------------
	// 5. Start Polling Loop
	// -------------------------------------------------------------------------
	logger.Info("Starting polling loop...")
	ticker := time.NewTicker(time.Duration(cfg.PollIntervalSeconds) * time.Second)
	defer ticker.Stop()

	// Run immediately on startup before first tick
	runScanCycle(cfg)

	for {
		select {
		case <-ticker.C:
			runScanCycle(cfg)

		case sig := <-quit:
			logger.Infof("Received signal %s. Shutting down gracefully...", sig)
			return
		}
	}
}

// runScanCycle performs one full scan cycle:
// 1. Fetch active devices from DB
// 2. Run parallel ping scans
// 3. Process and write results to DB
// 4. Run SNMP polling for UP+SNMP-enabled devices
func runScanCycle(cfg *config.Config) {
	logger.Info("--- Scan cycle started ---")
	cycleStart := time.Now()

	// Step 1: Get devices to scan
	devices, err := database.GetActiveDevices()
	if err != nil {
		logger.Errorf("Failed to fetch devices: %v", err)
		return
	}

	if len(devices) == 0 {
		logger.Info("No active devices found. Skipping scan cycle.")
		return
	}
	logger.Infof("Scanning %d device(s) with pool size %d...", len(devices), cfg.WorkerPoolSize)

	// Step 2: Run parallel ping scans
	results := scanner.RunPool(devices, cfg.WorkerPoolSize)

	// Step 3: Write results to DB and log status changes
	scanner.ProcessResults(results)

	// Step 4: SNMP polling for devices that are UP and have SNMP enabled
	for _, result := range results {
		if result.PingOK && result.Device.SNMPEnabled {
			if result.Device.Vendor == "server" {
				// VPS/Linux server — poll detailed metrics (CPU, RAM, disk, net)
				go snmp.PollVpsMetrics(result.Device)
			} else {
				// Network device — poll basic sysDescr/sysName/uptime
				go snmp.PollDevice(result.Device)
			}
		}
	}

	elapsed := time.Since(cycleStart)
	logger.Infof("--- Scan cycle complete in %.2fs ---", elapsed.Seconds())
}
