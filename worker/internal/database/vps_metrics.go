package database

import (
	"encoding/json"
	"fmt"
	"time"
)

// VpsMetricsRecord holds all SNMP metrics for a Linux/VPS server.
type VpsMetricsRecord struct {
	DeviceID      int64
	CpuUser       float64
	CpuSystem     float64
	CpuIdle       float64
	MemTotalKB    int64
	MemFreeKB     int64
	MemCachedKB   int64
	DiskPartitions []DiskPartition
	NetInterfaces  []NetInterface
	UptimeSec     int64
	SysDescr      string
	SysName       string
	PolledAt      time.Time
}

// DiskPartition represents one storage partition/disk.
type DiskPartition struct {
	Name    string `json:"name"`
	TotalKB int64  `json:"total_kb"`
	UsedKB  int64  `json:"used_kb"`
	Type    string `json:"type"`
}

// NetInterface represents one network interface's I/O counters.
type NetInterface struct {
	Name    string `json:"name"`
	RxBytes int64  `json:"rx_bytes"`
	TxBytes int64  `json:"tx_bytes"`
	Speed   int64  `json:"speed"` // Mbps
}

// InsertVpsMetrics upserts VPS metrics into the vps_metrics table.
// It keeps only the latest row per device (delete + insert for simplicity).
func InsertVpsMetrics(r VpsMetricsRecord) error {
	diskJSON, err := json.Marshal(r.DiskPartitions)
	if err != nil {
		return fmt.Errorf("InsertVpsMetrics: marshal disk: %w", err)
	}
	netJSON, err := json.Marshal(r.NetInterfaces)
	if err != nil {
		return fmt.Errorf("InsertVpsMetrics: marshal net: %w", err)
	}

	// Delete old rows for this device older than 48 hours (to keep history for charts)
	if _, err := DB.Exec("DELETE FROM vps_metrics WHERE device_id = ? AND polled_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)", r.DeviceID); err != nil {
		return fmt.Errorf("InsertVpsMetrics: delete old: %w", err)
	}

	query := `
		INSERT INTO vps_metrics
			(device_id, cpu_user, cpu_system, cpu_idle,
			 mem_total_kb, mem_free_kb, mem_cached_kb,
			 disk_partitions, net_interfaces,
			 uptime_sec, sys_descr, sys_name, polled_at,
			 created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
	`
	_, err = DB.Exec(query,
		r.DeviceID,
		r.CpuUser, r.CpuSystem, r.CpuIdle,
		r.MemTotalKB, r.MemFreeKB, r.MemCachedKB,
		string(diskJSON), string(netJSON),
		r.UptimeSec, r.SysDescr, r.SysName,
		r.PolledAt,
	)
	if err != nil {
		return fmt.Errorf("InsertVpsMetrics: insert error for device %d: %w", r.DeviceID, err)
	}
	return nil
}
