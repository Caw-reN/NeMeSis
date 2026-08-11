package database

import (
	"database/sql"
	"fmt"
	"time"
)

// DeviceRecord mirrors the relevant columns from the `devices` table
// that the worker needs for scanning. It does NOT include credentials.
type DeviceRecord struct {
	ID             int64
	Name           string
	IPAddress      string
	Vendor         string
	CurrentStatus  string
	SNMPEnabled    bool
	SNMPCommunity  sql.NullString
	SNMPVersion    string
}

// ScanResultRecord holds the result of a port scan to be upserted.
type ScanResultRecord struct {
	DeviceID    int64
	Port        int
	Protocol    string
	State       string
	ServiceName string
	IsDangerous bool
}

// GetActiveDevices fetches all active devices that need to be scanned.
func GetActiveDevices() ([]DeviceRecord, error) {
	query := `
		SELECT id, name, ip_address, vendor, status, snmp_enabled, snmp_community, snmp_version
		FROM devices
		WHERE is_active = 1
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("GetActiveDevices query error: %w", err)
	}
	defer rows.Close()

	var devices []DeviceRecord
	for rows.Next() {
		var d DeviceRecord
		err := rows.Scan(
			&d.ID, &d.Name, &d.IPAddress, &d.Vendor,
			&d.CurrentStatus, &d.SNMPEnabled, &d.SNMPCommunity, &d.SNMPVersion,
		)
		if err != nil {
			return nil, fmt.Errorf("GetActiveDevices scan error: %w", err)
		}
		devices = append(devices, d)
	}

	return devices, rows.Err()
}

// UpdateDeviceStatus updates the device status, latency, and last_seen_at.
func UpdateDeviceStatus(deviceID int64, status string, latencyMs float64, seenAt *time.Time) error {
	query := `
		UPDATE devices
		SET status = ?, latency_ms = ?, last_seen_at = ?, updated_at = NOW()
		WHERE id = ?
	`
	_, err := DB.Exec(query, status, latencyMs, seenAt, deviceID)
	if err != nil {
		return fmt.Errorf("UpdateDeviceStatus error for device %d: %w", deviceID, err)
	}
	return nil
}

// InsertDeviceLog writes a log entry into device_logs.
// user_id is NULL for system/worker-generated logs.
func InsertDeviceLog(deviceID int64, eventType, message string, metadataJSON *string) error {
	query := `
		INSERT INTO device_logs (device_id, user_id, event_type, message, metadata, created_at, updated_at)
		VALUES (?, NULL, ?, ?, ?, NOW(), NOW())
	`
	_, err := DB.Exec(query, deviceID, eventType, message, metadataJSON)
	if err != nil {
		return fmt.Errorf("InsertDeviceLog error for device %d: %w", deviceID, err)
	}
	return nil
}

// UpsertScanResult inserts or updates a port scan result.
func UpsertScanResult(r ScanResultRecord) error {
	query := `
		INSERT INTO scan_results (device_id, port, protocol, state, service_name, is_dangerous, scanned_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			state        = VALUES(state),
			service_name = VALUES(service_name),
			is_dangerous = VALUES(is_dangerous),
			scanned_at   = VALUES(scanned_at),
			updated_at   = NOW()
	`
	_, err := DB.Exec(query, r.DeviceID, r.Port, r.Protocol, r.State, r.ServiceName, r.IsDangerous)
	if err != nil {
		return fmt.Errorf("UpsertScanResult error for device %d port %d: %w", r.DeviceID, r.Port, err)
	}
	return nil
}
