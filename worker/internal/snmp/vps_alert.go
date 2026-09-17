package snmp

import (
	"fmt"
	"sync"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/internal/notifier"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

// ─── Thresholds ───────────────────────────────────────────────────────────────

const (
	AlertThresholdCPU  = 85.0 // % CPU used (100 - idle)
	AlertThresholdRAM  = 85.0 // % RAM used
	AlertThresholdDisk = 85.0 // % Disk used

	// Minimum interval between the same alert type for the same device.
	// Prevents spam when metrics stay high for multiple poll cycles.
	AlertCooldown = 30 * time.Minute
)

// ─── Cooldown tracker ─────────────────────────────────────────────────────────

type alertKey struct {
	deviceID  int64
	alertType string // "cpu" | "ram" | "disk"
}

var (
	lastAlertMu   sync.Mutex
	lastAlertSent = map[alertKey]time.Time{}
)

// canAlert returns true if the cooldown has expired for this device+type pair.
func canAlert(deviceID int64, alertType string) bool {
	key := alertKey{deviceID, alertType}
	lastAlertMu.Lock()
	defer lastAlertMu.Unlock()
	if t, ok := lastAlertSent[key]; ok && time.Since(t) < AlertCooldown {
		return false
	}
	lastAlertSent[key] = time.Now()
	return true
}

// ─── Main checker ─────────────────────────────────────────────────────────────

// CheckVpsAlerts evaluates VPS metrics against thresholds and sends
// Telegram alerts if any metric is critically high.
// Called right after InsertVpsMetrics so data is already persisted.
func CheckVpsAlerts(device database.DeviceRecord, rec database.VpsMetricsRecord) {
	token, err := database.GetSetting("telegram_bot_token")
	if err != nil || token == "" {
		return // Telegram not configured
	}
	chatID, err := database.GetSetting("telegram_chat_id")
	if err != nil || chatID == "" {
		return
	}

	ts := time.Now().Format("2006-01-02 15:04:05")

	// ── CPU ───────────────────────────────────────────────────────────────────
	cpuUsed := 100.0 - rec.CpuIdle
	if cpuUsed >= AlertThresholdCPU && canAlert(device.ID, "cpu") {
		msg := fmt.Sprintf(
			"🔥 *SERVER ALERT — CPU Tinggi*\n\n"+
				"🖥 *Server:* %s\n"+
				"🌐 *IP:* `%s`\n"+
				"📊 *CPU Used:* `%.1f%%` (threshold: %.0f%%)\n"+
				"   ├ User: `%.1f%%`\n"+
				"   ├ System: `%.1f%%`\n"+
				"   └ Idle: `%.1f%%`\n"+
				"⏰ *Waktu:* %s",
			device.Name, device.IPAddress,
			cpuUsed, AlertThresholdCPU,
			rec.CpuUser, rec.CpuSystem, rec.CpuIdle,
			ts,
		)
		go notifier.SendMessage(token, chatID, msg)
		logger.Warnf("⚠️  CPU alert sent for %s: %.1f%%", device.Name, cpuUsed)
		_ = database.InsertDeviceLog(device.ID, "alert",
			fmt.Sprintf("CPU tinggi: %.1f%% (threshold %.0f%%)", cpuUsed, AlertThresholdCPU), nil)
	}

	// ── RAM ───────────────────────────────────────────────────────────────────
	if rec.MemTotalKB > 0 {
		memUsedKB := rec.MemTotalKB - rec.MemFreeKB - rec.MemCachedKB
		if memUsedKB < 0 {
			memUsedKB = rec.MemTotalKB - rec.MemFreeKB
		}
		memUsedPct := float64(memUsedKB) / float64(rec.MemTotalKB) * 100

		if memUsedPct >= AlertThresholdRAM && canAlert(device.ID, "ram") {
			msg := fmt.Sprintf(
				"🧠 *SERVER ALERT — RAM Tinggi*\n\n"+
					"🖥 *Server:* %s\n"+
					"🌐 *IP:* `%s`\n"+
					"📊 *RAM Used:* `%.1f%%` (threshold: %.0f%%)\n"+
					"   ├ Used: `%d MB`\n"+
					"   ├ Free: `%d MB`\n"+
					"   └ Total: `%d MB`\n"+
					"⏰ *Waktu:* %s",
				device.Name, device.IPAddress,
				memUsedPct, AlertThresholdRAM,
				memUsedKB/1024,
				rec.MemFreeKB/1024,
				rec.MemTotalKB/1024,
				ts,
			)
			go notifier.SendMessage(token, chatID, msg)
			logger.Warnf("⚠️  RAM alert sent for %s: %.1f%%", device.Name, memUsedPct)
			_ = database.InsertDeviceLog(device.ID, "alert",
				fmt.Sprintf("RAM tinggi: %.1f%% (threshold %.0f%%)", memUsedPct, AlertThresholdRAM), nil)
		}
	}

	// ── Disk ──────────────────────────────────────────────────────────────────
	if len(rec.DiskPartitions) > 0 {
		var totalKB, usedKB int64
		for _, p := range rec.DiskPartitions {
			totalKB += p.TotalKB
			usedKB += p.UsedKB
		}
		if totalKB > 0 {
			diskUsedPct := float64(usedKB) / float64(totalKB) * 100
			if diskUsedPct >= AlertThresholdDisk && canAlert(device.ID, "disk") {
				msg := fmt.Sprintf(
					"💾 *SERVER ALERT — Disk Hampir Penuh*\n\n"+
						"🖥 *Server:* %s\n"+
						"🌐 *IP:* `%s`\n"+
						"📊 *Disk Used:* `%.1f%%` (threshold: %.0f%%)\n"+
						"   ├ Used: `%.1f GB`\n"+
						"   ├ Free: `%.1f GB`\n"+
						"   └ Total: `%.1f GB`\n"+
						"⏰ *Waktu:* %s",
					device.Name, device.IPAddress,
					diskUsedPct, AlertThresholdDisk,
					float64(usedKB)/1024/1024,
					float64(totalKB-usedKB)/1024/1024,
					float64(totalKB)/1024/1024,
					ts,
				)
				go notifier.SendMessage(token, chatID, msg)
				logger.Warnf("⚠️  Disk alert sent for %s: %.1f%%", device.Name, diskUsedPct)
				_ = database.InsertDeviceLog(device.ID, "alert",
					fmt.Sprintf("Disk hampir penuh: %.1f%% (threshold %.0f%%)", diskUsedPct, AlertThresholdDisk), nil)
			}
		}
	}
}
