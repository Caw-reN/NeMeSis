package notifier

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

type TelegramUpdate struct {
	UpdateID int `json:"update_id"`
	Message  struct {
		MessageID int `json:"message_id"`
		Chat      struct {
			ID int64 `json:"id"`
		} `json:"chat"`
		Text string `json:"text"`
	} `json:"message"`
}

type TelegramUpdateResponse struct {
	Ok     bool             `json:"ok"`
	Result []TelegramUpdate `json:"result"`
}

// StartBotListener runs continuously, long-polling the Telegram getUpdates API.
func StartBotListener() {
	var offset int
	client := &http.Client{Timeout: 60 * time.Second} // Long timeout for long polling

	for {
		// Re-fetch token and allowed ChatID in case they were updated in the UI
		token, _ := database.GetSetting("telegram_bot_token")
		allowedChatIDStr, _ := database.GetSetting("telegram_chat_id")
		allowedChatID, _ := strconv.ParseInt(allowedChatIDStr, 10, 64)

		if token == "" {
			time.Sleep(30 * time.Second) // wait before retrying if not configured
			continue
		}

		url := fmt.Sprintf("https://api.telegram.org/bot%s/getUpdates?offset=%d&timeout=30", token, offset)
		
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			logger.Errorf("Failed to create getUpdates request: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		resp, err := client.Do(req)
		if err != nil {
			// Expected during network disconnects or timeouts
			time.Sleep(5 * time.Second)
			continue
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		var updateResp TelegramUpdateResponse
		if err := json.Unmarshal(body, &updateResp); err != nil {
			logger.Errorf("Failed to decode getUpdates response: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		if !updateResp.Ok {
			time.Sleep(5 * time.Second)
			continue
		}

		for _, update := range updateResp.Result {
			offset = update.UpdateID + 1

			// Ignore empty messages
			text := strings.TrimSpace(update.Message.Text)
			chatID := update.Message.Chat.ID
			
			if text == "" {
				continue
			}

			// Security: Only process commands from the allowed Chat ID
			if allowedChatID != 0 && chatID != allowedChatID {
				logger.Warnf("Unauthorized bot access attempt from Chat ID: %d", chatID)
				continue
			}

			// Handle commands
			if strings.HasPrefix(text, "/perangkat") {
				handlePerangkatCommand(token, chatID)
			} else if strings.HasPrefix(text, "/status") {
				handleStatusCommand(token, chatID)
			}
		}
	}
}

func handlePerangkatCommand(token string, chatID int64) {
	devices, err := database.GetActiveDevices()
	if err != nil {
		SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Gagal mengambil data perangkat dari database.")
		return
	}

	if len(devices) == 0 {
		SendMessage(token, fmt.Sprintf("%d", chatID), "ℹ️ Tidak ada perangkat yang aktif/diawasi.")
		return
	}

	var sb strings.Builder
	sb.WriteString("📊 *Daftar Status Perangkat*\n\n")

	for _, d := range devices {
		icon := "✅"
		if d.CurrentStatus == "down" {
			icon = "🚨"
		}
		
		ip := d.IPAddress
		if ip == "" {
			ip = "No IP"
		}

		sb.WriteString(fmt.Sprintf("%s *%s*\n└ `%s`\n\n", icon, d.Name, ip))
	}

	SendMessage(token, fmt.Sprintf("%d", chatID), sb.String())
}

func handleStatusCommand(token string, chatID int64) {
	devices, err := database.GetActiveDevices()
	if err != nil {
		SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Gagal mengambil data perangkat dari database.")
		return
	}

	upCount := 0
	downCount := 0

	for _, d := range devices {
		if d.CurrentStatus == "down" {
			downCount++
		} else {
			upCount++
		}
	}

	total := len(devices)

	msg := fmt.Sprintf(
		"📈 *Ringkasan Status Jaringan*\n\n"+
			"Total Perangkat: *%d*\n"+
			"✅ UP: *%d*\n"+
			"🚨 DOWN: *%d*",
		total, upCount, downCount,
	)

	SendMessage(token, fmt.Sprintf("%d", chatID), msg)
}
