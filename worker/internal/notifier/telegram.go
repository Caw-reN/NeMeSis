package notifier

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

var (
	wibLocation = time.FixedZone("WIB", 7*3600)

	// Flapping & deduplication protection
	deviceAlertMu  sync.Mutex
	deviceAlertMap = make(map[int64]*deviceAlertState)
)

type deviceAlertState struct {
	lastStatus    string
	lastAlertTime time.Time
	flapping      bool
	flapCount     int
}

// SendTelegramAlert sends a message to Telegram about a device status change.
func SendTelegramAlert(device database.DeviceRecord, status string, latency float64) {
	// Fetch configuration from database dynamically
	token, err := database.GetSetting("telegram_bot_token")
	if err != nil || token == "" {
		return // Silently skip if not configured
	}

	chatID, err := database.GetSetting("telegram_chat_id")
	if err != nil || chatID == "" {
		return
	}

	// Anti-flapping and deduplication check
	deviceAlertMu.Lock()
	now := time.Now()
	state, exists := deviceAlertMap[device.ID]

	if !exists {
		deviceAlertMap[device.ID] = &deviceAlertState{
			lastStatus:    status,
			lastAlertTime: now,
		}
		deviceAlertMu.Unlock()
	} else {
		// Suppress duplicate alert for identical status
		if state.lastStatus == status {
			deviceAlertMu.Unlock()
			return
		}

		elapsed := now.Sub(state.lastAlertTime)

		// Flapping detection: status changed in less than 90 seconds
		if elapsed < 90*time.Second {
			state.flapCount++
			if state.flapCount >= 2 {
				// Rapid toggling detected
				if !state.flapping {
					state.flapping = true
					state.lastStatus = status
					state.lastAlertTime = now
					deviceAlertMu.Unlock()

					// Send one single flapping warning notification
					wibTime := now.In(wibLocation).Format("2006-01-02 15:04:05") + " WIB"
					flapMsg := fmt.Sprintf(
						"⚠️ *[FLAPPING WARNING] KONEKSI TIDAK STABIL* ⚠️\n\n"+
							"🖥 *Device:* %s\n"+
							"🌐 *IP:* `%s`\n"+
							"⚡ *Kondisi:* Status perangkat berubah-ubah (UP/DOWN) secara cepat.\n"+
							"🔇 *Tindakan:* Notifikasi Telegram untuk perangkat ini diredam sementara hingga koneksi stabil.\n\n"+
							"⏰ *Waktu:* %s",
						device.Name, device.IPAddress, wibTime,
					)
					SendMessage(token, chatID, flapMsg)
					return
				}

				// Already in flapping mode: suppress notification
				state.lastStatus = status
				state.lastAlertTime = now
				deviceAlertMu.Unlock()
				logger.Warnf("Suppressed flapping Telegram alert for %s (%s)", device.Name, status)
				return
			}
		} else {
			// Stabilized after previous flapping or normal interval
			state.flapCount = 0
			state.flapping = false
		}

		state.lastStatus = status
		state.lastAlertTime = now
		deviceAlertMu.Unlock()
	}

	// Prepare message content
	var icon string
	var statusText string

	if status == "down" {
		icon = "🚨"
		statusText = "OFFLINE (DOWN)"
	} else {
		icon = "✅"
		statusText = "RECOVERED (UP)"
	}

	currentTime := now.In(wibLocation).Format("2006-01-02 15:04:05") + " WIB"
	latencyText := ""
	if status == "up" {
		latencyText = fmt.Sprintf("\n⏱ Latency: %.2f ms", latency)
	}

	message := fmt.Sprintf(
		"%s *NMS ALERT* %s\n\n"+
			"🖥 *Device:* %s\n"+
			"🌐 *IP:* %s\n"+
			"📉 *Status:* %s%s\n"+
			"⏰ *Time:* %s",
		icon, icon, device.Name, device.IPAddress, statusText, latencyText, currentTime,
	)

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       message,
		"parse_mode": "Markdown",
		"reply_markup": map[string]interface{}{
			"keyboard": [][]map[string]string{
				{
					{"text": "/status"},
					{"text": "/perangkat"},
				},
				{
					{"text": "/status_server"},
					{"text": "/ping"},
				},
			},
			"resize_keyboard": true,
		},
	}
	payloadBytes, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		logger.Errorf("Failed to create Telegram request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("Failed to send Telegram alert: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.Errorf("Telegram API returned non-OK status: %d", resp.StatusCode)
	} else {
		logger.Infof("Sent Telegram alert for device %s (%s)", device.Name, status)
	}
}

// SendMessage sends a generic markdown-formatted text message to a specific Chat ID.
func SendMessage(token, chatID, text string) {
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
		"reply_markup": map[string]interface{}{
			"keyboard": [][]map[string]string{
				{
					{"text": "/status"},
					{"text": "/perangkat"},
				},
				{
					{"text": "/status_server"},
					{"text": "/ping"},
				},
			},
			"resize_keyboard": true,
		},
	}
	payloadBytes, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		logger.Errorf("Failed to create Telegram request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("Failed to send Telegram message: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.Errorf("Telegram API returned non-OK status: %d", resp.StatusCode)
	}
}

// SendMessageWithInlineKeyboard sends a message with an inline keyboard.
func SendMessageWithInlineKeyboard(token, chatID, text string, inlineKeyboard [][]map[string]string) {
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
		"reply_markup": map[string]interface{}{
			"inline_keyboard": inlineKeyboard,
		},
	}
	payloadBytes, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		logger.Errorf("Failed to create Telegram request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Errorf("Failed to send Telegram message with inline keyboard: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.Errorf("Telegram API returned non-OK status: %d", resp.StatusCode)
	}
}
