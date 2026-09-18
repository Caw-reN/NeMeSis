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
	CallbackQuery *CallbackQuery `json:"callback_query,omitempty"`
}

type CallbackQuery struct {
	ID      string `json:"id"`
	From    struct {
		ID int64 `json:"id"`
	} `json:"from"`
	Message struct {
		MessageID int `json:"message_id"`
		Chat      struct {
			ID int64 `json:"id"`
		} `json:"chat"`
	} `json:"message"`
	Data string `json:"data"`
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

			// Handle callback queries
			if update.CallbackQuery != nil {
				chatID := update.CallbackQuery.Message.Chat.ID
				if allowedChatID != 0 && chatID != allowedChatID {
					logger.Warnf("Unauthorized bot callback attempt from Chat ID: %d", chatID)
					continue
				}
				handleCallbackQuery(token, chatID, update.CallbackQuery.Data)
				continue
			}

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
			} else if strings.HasPrefix(text, "/status_server") {
				handleStatusServerCommand(token, chatID)
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

	// Group devices by type
	grouped := make(map[string][]database.DeviceRecord)
	for _, d := range devices {
		t := d.Type
		if t == "" {
			t = "Uncategorized"
		}
		// capitalize first letter
		if len(t) > 0 {
			t = strings.ToUpper(t[:1]) + t[1:]
		}
		grouped[t] = append(grouped[t], d)
	}

	for devType, devs := range grouped {
		sb.WriteString(fmt.Sprintf("🔹 *%s*\n", devType))
		for _, d := range devs {
			icon := "✅"
			if d.CurrentStatus == "down" {
				icon = "🚨"
			}

			ip := d.IPAddress
			if ip == "" {
				ip = "No IP"
			}

			sb.WriteString(fmt.Sprintf("%s %s (`%s`)\n", icon, d.Name, ip))
		}
		sb.WriteString("\n")
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

func handleStatusServerCommand(token string, chatID int64) {
	devices, err := database.GetActiveDevices()
	if err != nil {
		SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Gagal mengambil data perangkat dari database.")
		return
	}

	var servers []database.DeviceRecord
	for _, d := range devices {
		if strings.ToLower(d.Type) == "linux" || strings.ToLower(d.Type) == "vps" || strings.ToLower(d.Type) == "server" {
			servers = append(servers, d)
		}
	}

	if len(servers) == 0 {
		SendMessage(token, fmt.Sprintf("%d", chatID), "ℹ️ Tidak ada server (VPS/Linux) yang aktif/diawasi.")
		return
	}

	msg := "🖥 *Pilih Server*\nSilakan pilih server untuk melihat statistik resource-nya:"
	
	var inlineKeyboard [][]map[string]string
	for i, s := range servers {
		row := []map[string]string{
			{
				"text": fmt.Sprintf("%d. %s", i+1, s.Name),
				"callback_data": fmt.Sprintf("server_stats_%d", s.ID),
			},
		}
		inlineKeyboard = append(inlineKeyboard, row)
	}

	SendMessageWithInlineKeyboard(token, fmt.Sprintf("%d", chatID), msg, inlineKeyboard)
}

func handleCallbackQuery(token string, chatID int64, data string) {
	if strings.HasPrefix(data, "server_stats_") {
		idStr := strings.TrimPrefix(data, "server_stats_")
		deviceID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			SendMessage(token, fmt.Sprintf("%d", chatID), "❌ ID Server tidak valid.")
			return
		}

		metrics, err := database.GetLatestVpsMetrics(deviceID)
		if err != nil {
			SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Belum ada data statistik untuk server ini atau server sedang offline.")
			return
		}

		// Hitung persentase RAM
		var ramUsage float64 = 0
		if metrics.MemTotalKB > 0 {
			usedKB := metrics.MemTotalKB - metrics.MemFreeKB - metrics.MemCachedKB
			ramUsage = float64(usedKB) / float64(metrics.MemTotalKB) * 100
		}

		// Hitung disk usage
		var totalDisk, usedDisk int64
		for _, d := range metrics.DiskPartitions {
			totalDisk += d.TotalKB
			usedDisk += d.UsedKB
		}
		var diskUsage float64 = 0
		if totalDisk > 0 {
			diskUsage = float64(usedDisk) / float64(totalDisk) * 100
		}

		uptimeDuration := time.Duration(metrics.UptimeSec) * time.Second
		days := int(uptimeDuration.Hours()) / 24
		hours := int(uptimeDuration.Hours()) % 24
		minutes := int(uptimeDuration.Minutes()) % 60

		msg := fmt.Sprintf(
			"📊 *Statistik Resource Server*\n\n"+
				"🖥 *Hostname:* %s\n"+
				"⏱ *Uptime:* %d hari, %d jam, %d menit\n\n"+
				"⚙️ *CPU Usage:* %.2f%%\n"+
				"🧠 *RAM Usage:* %.2f%% (Total: %d MB)\n"+
				"💾 *Disk Usage:* %.2f%% (Total: %d GB)\n\n"+
				"_Data diambil pada: %s_",
			metrics.SysName,
			days, hours, minutes,
			metrics.CpuUser+metrics.CpuSystem,
			ramUsage, metrics.MemTotalKB/1024,
			diskUsage, totalDisk/(1024*1024),
			metrics.PolledAt.Format("2006-01-02 15:04:05"),
		)

		SendMessage(token, fmt.Sprintf("%d", chatID), msg)
	}
}
