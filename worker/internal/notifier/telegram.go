package notifier

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

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

	currentTime := time.Now().Format("2006-01-02 15:04:05")
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
