package internet

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/internal/notifier"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
	"github.com/Caw-reN/NeMeSis/worker/pkg/pinger"
)

var (
	mu            sync.Mutex
	lastStatus    string    // "up" or "down"
	lastAlertTime time.Time
	wibLocation   = time.FixedZone("WIB", 7*3600)
)

// CheckInternet tests connectivity to public internet DNS/hosts.
// It updates the database settings table and dispatches Telegram alerts on state transitions.
func CheckInternet() {
	// 1. Determine targets to test
	targetsRaw, err := database.GetSetting("internet_ping_targets")
	if err != nil || strings.TrimSpace(targetsRaw) == "" {
		targetsRaw = "8.8.8.8,1.1.1.1"
	}

	targets := strings.Split(targetsRaw, ",")
	var cleanTargets []string
	for _, t := range targets {
		trimmed := strings.TrimSpace(t)
		if trimmed != "" {
			cleanTargets = append(cleanTargets, trimmed)
		}
	}
	if len(cleanTargets) == 0 {
		cleanTargets = []string{"8.8.8.8", "1.1.1.1"}
	}

	var isOnline bool
	var activeTarget string
	var avgLatency float64
	var packetLoss float64

	// 2. Ping targets (try primary, fallback to secondary if needed)
	for _, target := range cleanTargets {
		res := pinger.Ping(target, 3, 2*time.Second)
		if res.Alive {
			isOnline = true
			activeTarget = target
			avgLatency = res.AvgRtt
			packetLoss = res.PacketLoss
			break
		}
	}

	status := "down"
	if isOnline {
		status = "up"
	} else {
		activeTarget = cleanTargets[0]
		packetLoss = 100.0
		avgLatency = 0.0
	}

	now := time.Now()
	nowWIB := now.In(wibLocation).Format("2006-01-02 15:04:05") + " WIB"

	// 3. Persist current internet status into settings table
	_ = database.SetSetting("internet_status", status)
	_ = database.SetSetting("internet_latency", fmt.Sprintf("%.2f", avgLatency))
	_ = database.SetSetting("internet_packet_loss", fmt.Sprintf("%.0f", packetLoss))
	_ = database.SetSetting("internet_target", activeTarget)
	_ = database.SetSetting("internet_checked_at", nowWIB)

	// 4. Handle State Transitions and Telegram Alerts
	mu.Lock()
	defer mu.Unlock()

	if lastStatus == "" {
		// First poll cycle after worker boot: initialize status without alerting
		lastStatus = status
		if status == "up" {
			logger.Infof("🌐 Internet Check: ONLINE | Target: %s | Latency: %.2fms", activeTarget, avgLatency)
		} else {
			logger.Warnf("🌐 Internet Check: OFFLINE | All targets unreachable")
		}
		return
	}

	// Status changed?
	if status != lastStatus {
		// Anti-flapping suppression: if status toggles in less than 60s
		if time.Since(lastAlertTime) < 60*time.Second {
			logger.Warnf("🌐 Internet status changed from %s to %s, but suppressed due to anti-flapping (<60s)", lastStatus, status)
			lastStatus = status
			return
		}

		lastStatus = status
		lastAlertTime = now

		token, _ := database.GetSetting("telegram_bot_token")
		chatID, _ := database.GetSetting("telegram_chat_id")

		if token != "" && chatID != "" {
			if status == "down" {
				alertMsg := fmt.Sprintf(
					"🚨 *[ALERT] KONEKSI INTERNET / WAN TERPUTUS* 🚨\n\n"+
						"🌐 *Target Pengujian:* `%s`\n"+
						"📉 *Status:* OFFLINE (100%% Packet Loss / RTO)\n"+
						"⏰ *Waktu:* %s\n\n"+
						"⚠️ *Peringatan:* Server NMS tidak dapat menjangkau jaringan internet publik. Periksa uplink ISP atau modem gateway!",
					strings.Join(cleanTargets, ", "), nowWIB,
				)
				notifier.SendMessage(token, chatID, alertMsg)
				logger.Warnf("🚨 Internet DOWN alert sent to Telegram")
			} else {
				recoveryMsg := fmt.Sprintf(
					"✅ *[RECOVERY] KONEKSI INTERNET KEMBALI NORMAL* ✅\n\n"+
						"🌐 *Target Respon:* `%s`\n"+
						"⏱ *Latency RTT:* `%.2f ms`\n"+
						"📦 *Packet Loss:* `%.0f%%`\n"+
						"⏰ *Waktu:* %s\n\n"+
						"✨ *Kondisi:* Koneksi jaringan luar (internet) telah pulih dan stabil.",
					activeTarget, avgLatency, packetLoss, nowWIB,
				)
				notifier.SendMessage(token, chatID, recoveryMsg)
				logger.Infof("✅ Internet RECOVERY alert sent to Telegram")
			}
		}
	} else {
		if status == "up" {
			logger.Infof("🌐 Internet Check: ONLINE | Target: %s | %.2fms", activeTarget, avgLatency)
		} else {
			logger.Warnf("🌐 Internet Check: STILL OFFLINE")
		}
	}
}
