package notifier

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
	"github.com/Caw-reN/NeMeSis/worker/pkg/pinger"
)

var (
	userStateMu sync.Mutex
	userStates  = make(map[int64]string) // chatID -> state (e.g. "awaiting_ping_ip")
)

func setUserState(chatID int64, state string) {
	userStateMu.Lock()
	defer userStateMu.Unlock()
	if state == "" {
		delete(userStates, chatID)
	} else {
		userStates[chatID] = state
	}
}

func getUserState(chatID int64) string {
	userStateMu.Lock()
	defer userStateMu.Unlock()
	return userStates[chatID]
}

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

			// Check if user is in an active conversational state (e.g. entering manual ping IP)
			currentState := getUserState(chatID)
			if currentState == "awaiting_ping_ip" {
				if text == "/cancel" || text == "batal" || text == "Batal" {
					setUserState(chatID, "")
					SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Ping dibatalkan.")
					continue
				}

				// Reset state and run ping to the user-entered IP or hostname
				setUserState(chatID, "")
				target := strings.TrimSpace(text)
				go executeAndSendPing(token, chatID, target, "")
				continue
			}

			// Handle commands
			if strings.HasPrefix(text, "/ping") {
				parts := strings.Fields(text)
				if len(parts) > 1 {
					// Direct command format: /ping 8.8.8.8
					target := strings.TrimSpace(parts[1])
					go executeAndSendPing(token, chatID, target, "")
				} else {
					// Menu format: /ping
					handlePingMenuCommand(token, chatID)
				}
			} else if strings.HasPrefix(text, "/perangkat") {
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

	// Fetch Internet status from settings
	inetStatus, _ := database.GetSetting("internet_status")
	inetLatency, _ := database.GetSetting("internet_latency")
	inetTarget, _ := database.GetSetting("internet_target")
	if inetTarget == "" {
		inetTarget = "8.8.8.8"
	}

	inetText := "⚪ _Belum diuji_"
	if inetStatus == "up" {
		inetText = fmt.Sprintf("✅ *ONLINE* (`%s ms` ke `%s`)", inetLatency, inetTarget)
	} else if inetStatus == "down" {
		inetText = "🚨 *OFFLINE* (RTO / Paket Loss 100%)"
	}

	msg := fmt.Sprintf(
		"📈 *Ringkasan Status Jaringan*\n\n"+
			"🌐 *Status Internet:* %s\n\n"+
			"🖥 *Total Perangkat:* *%d*\n"+
			"✅ UP: *%d*\n"+
			"🚨 DOWN: *%d*",
		inetText, total, upCount, downCount,
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
	if data == "ping_cancel" {
		setUserState(chatID, "")
		SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Operasi ping dibatalkan.")
		return
	}

	if data == "ping_custom" {
		setUserState(chatID, "awaiting_ping_ip")
		msg := "🌐 *Input IP / Hostname Manual*\n\n" +
			"Silakan ketik alamat IP atau hostname yang ingin Anda uji ping.\n" +
			"Contoh: `8.8.8.8` atau `192.168.1.1` atau `google.com`\n\n" +
			"_Ketik /cancel untuk membatalkan._"
		SendMessage(token, fmt.Sprintf("%d", chatID), msg)
		return
	}

	if data == "ping_inet_google" {
		go executeAndSendPing(token, chatID, "8.8.8.8", "Internet (Google DNS 8.8.8.8)")
		return
	}

	if data == "ping_inet_cloudflare" {
		go executeAndSendPing(token, chatID, "1.1.1.1", "Internet (Cloudflare DNS 1.1.1.1)")
		return
	}

	if strings.HasPrefix(data, "ping_dev_") {
		idStr := strings.TrimPrefix(data, "ping_dev_")
		deviceID, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			SendMessage(token, fmt.Sprintf("%d", chatID), "❌ ID Perangkat tidak valid.")
			return
		}

		devices, err := database.GetActiveDevices()
		if err != nil {
			SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Gagal mengambil data perangkat dari database.")
			return
		}

		var targetDevice *database.DeviceRecord
		for _, d := range devices {
			if d.ID == deviceID {
				targetDevice = &d
				break
			}
		}

		if targetDevice == nil || targetDevice.IPAddress == "" {
			SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Perangkat tidak ditemukan atau belum memiliki alamat IP.")
			return
		}

		go executeAndSendPing(token, chatID, targetDevice.IPAddress, targetDevice.Name)
		return
	}

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
			metrics.PolledAt.In(time.FixedZone("WIB", 7*3600)).Format("2006-01-02 15:04:05") + " WIB",
		)

		SendMessage(token, fmt.Sprintf("%d", chatID), msg)
	}
}

func handlePingMenuCommand(token string, chatID int64) {
	devices, err := database.GetActiveDevices()
	if err != nil {
		SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Gagal mengambil data perangkat dari database.")
		return
	}

	msg := "📡 *NMS Ping Tool — Diagnostik Jaringan*\n\n" +
		"Pilih salah satu perangkat terdaftar di bawah untuk melakukan ping langsung, atau klik *Input IP Lain* untuk memasukkan IP tujuan secara manual:"

	var inlineKeyboard [][]map[string]string

	// Direct Internet Ping buttons
	inlineKeyboard = append(inlineKeyboard, []map[string]string{
		{
			"text":          "🌐 Ping Internet Google (8.8.8.8)",
			"callback_data": "ping_inet_google",
		},
	})
	inlineKeyboard = append(inlineKeyboard, []map[string]string{
		{
			"text":          "🌐 Ping Internet Cloudflare (1.1.1.1)",
			"callback_data": "ping_inet_cloudflare",
		},
	})

	// List active devices that have IP address
	for _, d := range devices {
		if d.IPAddress == "" {
			continue
		}
		statusIcon := "🟢"
		if d.CurrentStatus == "down" {
			statusIcon = "🔴"
		}
		row := []map[string]string{
			{
				"text":          fmt.Sprintf("%s %s (%s)", statusIcon, d.Name, d.IPAddress),
				"callback_data": fmt.Sprintf("ping_dev_%d", d.ID),
			},
		}
		inlineKeyboard = append(inlineKeyboard, row)
	}

	// Button to input other IP
	inlineKeyboard = append(inlineKeyboard, []map[string]string{
		{
			"text":          "🌐 ➕ Input IP Manual / Lain",
			"callback_data": "ping_custom",
		},
	})

	// Button to cancel
	inlineKeyboard = append(inlineKeyboard, []map[string]string{
		{
			"text":          "❌ Batal",
			"callback_data": "ping_cancel",
		},
	})

	SendMessageWithInlineKeyboard(token, fmt.Sprintf("%d", chatID), msg, inlineKeyboard)
}

func executeAndSendPing(token string, chatID int64, target string, deviceName string) {
	target = strings.TrimSpace(target)
	if target == "" {
		SendMessage(token, fmt.Sprintf("%d", chatID), "❌ Alamat IP atau hostname tidak boleh kosong.")
		return
	}

	if strings.ToLower(target) == "internet" {
		target = "8.8.8.8"
		deviceName = "Internet (Google DNS 8.8.8.8)"
	}

	displayName := fmt.Sprintf("`%s`", target)
	if deviceName != "" {
		displayName = fmt.Sprintf("*%s* (`%s`)", deviceName, target)
	}

	// Send initial status notification
	SendMessage(token, fmt.Sprintf("%d", chatID), fmt.Sprintf("⏳ _Sedang melakukan ICMP ping (4 paket) ke %s..._", displayName))

	// Run ping: 4 packets, 4 seconds timeout
	res := pinger.Ping(target, 4, 4*time.Second)

	currentTime := time.Now().In(time.FixedZone("WIB", 7*3600)).Format("2006-01-02 15:04:05") + " WIB"

	if res.Error != nil {
		msg := fmt.Sprintf(
			"📡 *Hasil Diagnostik Ping*\n\n"+
				"🌐 *Target:* %s\n"+
				"❌ *Gagal:* `%v`\n\n"+
				"⏰ _Waktu: %s_",
			displayName, res.Error, currentTime,
		)
		SendMessage(token, fmt.Sprintf("%d", chatID), msg)
		return
	}

	var sb strings.Builder
	sb.WriteString("📡 *Hasil Diagnostik Ping*\n\n")
	sb.WriteString(fmt.Sprintf("🌐 *Target:* %s\n", displayName))

	if res.Alive {
		sb.WriteString("📊 *Status:* ✅ *REACHABLE (ONLINE)*\n\n")
		sb.WriteString(fmt.Sprintf("📦 *Statistik Paket:*\n• Terkirim: `%d` | Diterima: `%d`\n• Packet Loss: `%.0f%%`\n\n",
			res.PacketsSent, res.PacketsRecv, res.PacketLoss))
		sb.WriteString(fmt.Sprintf("⏱ *Latency Round-Trip (RTT):*\n• Min: `%.2f ms`\n• Avg: `%.2f ms`\n• Max: `%.2f ms`\n• Jitter: `±%.2f ms`\n\n",
			res.MinRtt, res.AvgRtt, res.MaxRtt, res.StdDevRtt))
	} else {
		sb.WriteString("📊 *Status:* ❌ *UNREACHABLE (REQUEST TIMED OUT)*\n\n")
		sb.WriteString(fmt.Sprintf("📦 *Statistik Paket:*\n• Terkirim: `%d` | Diterima: `%d`\n• Packet Loss: `%.0f%%`\n\n",
			res.PacketsSent, res.PacketsRecv, res.PacketLoss))
		sb.WriteString("⚠️ _Tidak ada balasan ICMP echo dari host target (100% loss)._\n\n")
	}

	sb.WriteString(fmt.Sprintf("⏰ _Diuji pada: %s_", currentTime))
	SendMessage(token, fmt.Sprintf("%d", chatID), sb.String())
}
