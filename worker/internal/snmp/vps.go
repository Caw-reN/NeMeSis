package snmp

import (
	"fmt"
	"strings"
	"time"

	"github.com/gosnmp/gosnmp"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

// ─── OID Definitions ───────────────────────────────────────────────────────────
// UCD-SNMP-MIB (Linux specific)
const (
	// CPU (UCD-SNMP-MIB::ssCpu*)
	oidCpuUser   = "1.3.6.1.4.1.2021.11.9.0"  // ssCpuUser (%)
	oidCpuSystem = "1.3.6.1.4.1.2021.11.10.0" // ssCpuSystem (%)
	oidCpuIdle   = "1.3.6.1.4.1.2021.11.11.0" // ssCpuIdle (%)

	// RAM (UCD-SNMP-MIB::mem*)
	oidMemTotal  = "1.3.6.1.4.1.2021.4.5.0"  // memTotalReal  → /proc/meminfo MemTotal (KB)
	oidMemFree   = "1.3.6.1.4.1.2021.4.6.0"  // memAvailReal  → /proc/meminfo MemFree  (KB)
	oidMemBuffer = "1.3.6.1.4.1.2021.4.14.0" // memBuffer     → /proc/meminfo Buffers  (KB)
	oidMemCached = "1.3.6.1.4.1.2021.4.15.0" // memCached     → /proc/meminfo Cached   (KB)

	// System (SNMPv2-MIB)
	oidSysDescr  = "1.3.6.1.2.1.1.1.0"
	oidSysName   = "1.3.6.1.2.1.1.5.0"
	oidSysUptime = "1.3.6.1.2.1.1.3.0"

	// HOST-RESOURCES-MIB — hrStorageTable (disk)
	oidHrStorageTable = "1.3.6.1.2.1.25.2.3"

	// IF-MIB — ifTable (network interfaces)
	oidIfDescr    = "1.3.6.1.2.1.2.2.1.2"
	oidIfInOctets = "1.3.6.1.2.1.2.2.1.10"
	oidIfOutOctets = "1.3.6.1.2.1.2.2.1.16"
	oidIfSpeed    = "1.3.6.1.2.1.2.2.1.5"
)

// PollVpsMetrics performs SNMP polling of a Linux/VPS server and saves
// CPU, RAM, disk, and network metrics to the database.
func PollVpsMetrics(device database.DeviceRecord) {
	if !device.SNMPEnabled || !device.SNMPCommunity.Valid {
		logger.Warnf("VPS SNMP: device %s has SNMP disabled or no community", device.Name)
		return
	}

	community := device.SNMPCommunity.String
	version := gosnmp.Version2c
	if device.SNMPVersion == "v1" {
		version = gosnmp.Version1
	}

	g := &gosnmp.GoSNMP{
		Target:    device.IPAddress,
		Port:      161,
		Community: community,
		Version:   version,
		Timeout:   5 * time.Second,
		Retries:   2,
	}

	if err := g.Connect(); err != nil {
		logger.Warnf("VPS SNMP: connect failed for %s (%s): %v", device.Name, device.IPAddress, err)
		msg := fmt.Sprintf("SNMP poll gagal: tidak dapat terhubung ke %s:161 — %v", device.IPAddress, err)
		_ = database.InsertDeviceLog(device.ID, "alert", msg, nil)
		return
	}
	defer g.Conn.Close()

	rec := database.VpsMetricsRecord{
		DeviceID: device.ID,
		PolledAt: time.Now(),
	}

	// ── Scalar OIDs (CPU + RAM + sysInfo) ─────────────────────────────────────
	scalars := []string{
		oidCpuUser, oidCpuSystem, oidCpuIdle,
		oidMemTotal, oidMemFree, oidMemBuffer, oidMemCached,
		oidSysDescr, oidSysName, oidSysUptime,
	}
	result, err := g.Get(scalars)
	if err != nil {
		logger.Warnf("VPS SNMP: GET scalars failed for %s: %v", device.Name, err)
		msg := fmt.Sprintf("SNMP GET gagal untuk %s: %v", device.IPAddress, err)
		_ = database.InsertDeviceLog(device.ID, "alert", msg, nil)
		return
	}
	for _, pdu := range result.Variables {
		oid := strings.TrimPrefix(pdu.Name, ".")
		switch oid {
		case oidCpuUser:
			rec.CpuUser = toFloat(pdu.Value)
		case oidCpuSystem:
			rec.CpuSystem = toFloat(pdu.Value)
		case oidCpuIdle:
			rec.CpuIdle = toFloat(pdu.Value)
		case oidMemTotal:
			rec.MemTotalKB = toInt64(pdu.Value)
		case oidMemFree:
			rec.MemFreeKB = toInt64(pdu.Value) // actual MemFree from /proc/meminfo
		case oidMemBuffer:
			rec.MemCachedKB += toInt64(pdu.Value) // add buffers to cached KB for display
		case oidMemCached:
			rec.MemCachedKB += toInt64(pdu.Value)
		case oidSysDescr:
			if b, ok := pdu.Value.([]byte); ok {
				rec.SysDescr = string(b)
			}
		case oidSysName:
			if b, ok := pdu.Value.([]byte); ok {
				rec.SysName = string(b)
			}
		case oidSysUptime:
			if v, ok := pdu.Value.(uint32); ok {
				rec.UptimeSec = int64(v) / 100
			}
		}
	}

	// ── RAM override from HOST-RESOURCES-MIB (more reliable on VMs) ─────────────
	if totalKB, usedKB, ok := pollRamFromHrStorage(g); ok && totalKB > 0 {
		rec.MemTotalKB  = totalKB
		rec.MemFreeKB   = totalKB - usedKB
		rec.MemCachedKB = 0 // hrStorage already gives net used, no separate cached
		logger.Infof("VPS %s: RAM from hrStorage — total=%dMB used=%dMB",
			device.Name, totalKB/1024, usedKB/1024)
	}

	// ── Disk — hrStorageTable walk ─────────────────────────────────────────────
	rec.DiskPartitions = pollDiskPartitions(g)

	// ── Network — ifTable walk ─────────────────────────────────────────────────
	rec.NetInterfaces = pollNetInterfaces(g)

	// ── Persist ───────────────────────────────────────────────────────────────
	if err := database.InsertVpsMetrics(rec); err != nil {
		logger.Errorf("VPS SNMP: failed to save metrics for device %d: %v", device.ID, err)
		return
	}

	// ── Check thresholds & send Telegram alerts if needed ─────────────────────
	go CheckVpsAlerts(device, rec)

	logger.Infof("🖥️  VPS %s (%s) — CPU: %.0f%% idle | RAM: %s/%s | Disk: %d partitions",
		device.Name, device.IPAddress,
		rec.CpuIdle,
		formatKB(rec.MemTotalKB-rec.MemFreeKB), formatKB(rec.MemTotalKB),
		len(rec.DiskPartitions),
	)
}

// ─── Disk Partitions ──────────────────────────────────────────────────────────

// hrStorageTable column sub-OIDs
const (
	hrStorageDescr     = "1.3.6.1.2.1.25.2.3.1.3"  // description (mount point)
	hrStorageAllocationUnits = "1.3.6.1.2.1.25.2.3.1.4" // bytes per unit
	hrStorageSize      = "1.3.6.1.2.1.25.2.3.1.5"  // total units
	hrStorageUsed      = "1.3.6.1.2.1.25.2.3.1.6"  // used units
	hrStorageType      = "1.3.6.1.2.1.25.2.3.1.2"  // type OID
)

func pollDiskPartitions(g *gosnmp.GoSNMP) []database.DiskPartition {
	// We need to walk 4 columns in parallel. Walk type first to detect "Fixed Disk"
	type rawRow struct {
		Description  string
		AllocUnits   int64
		SizeUnits    int64
		UsedUnits    int64
		TypeOID      string
	}
	rows := map[string]*rawRow{}

	walkCol := func(oid string, fn func(idx string, pdu gosnmp.SnmpPDU)) {
		_ = g.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
			name := strings.TrimPrefix(pdu.Name, ".")
			idx := strings.TrimPrefix(name, oid+".")
			if _, ok := rows[idx]; !ok {
				rows[idx] = &rawRow{}
			}
			fn(idx, pdu)
			return nil
		})
	}

	walkCol(hrStorageType, func(idx string, pdu gosnmp.SnmpPDU) {
		if b, ok := pdu.Value.([]byte); ok {
			rows[idx].TypeOID = string(b)
		} else {
			rows[idx].TypeOID = fmt.Sprintf("%v", pdu.Value)
		}
	})
	walkCol(hrStorageDescr, func(idx string, pdu gosnmp.SnmpPDU) {
		if b, ok := pdu.Value.([]byte); ok {
			rows[idx].Description = string(b)
		}
	})
	walkCol(hrStorageAllocationUnits, func(idx string, pdu gosnmp.SnmpPDU) {
		rows[idx].AllocUnits = toInt64(pdu.Value)
	})
	walkCol(hrStorageSize, func(idx string, pdu gosnmp.SnmpPDU) {
		rows[idx].SizeUnits = toInt64(pdu.Value)
	})
	walkCol(hrStorageUsed, func(idx string, pdu gosnmp.SnmpPDU) {
		rows[idx].UsedUnits = toInt64(pdu.Value)
	})

	var partitions []database.DiskPartition
	// hrStorageFixedDisk type ends with .25.2.1.4
	for _, row := range rows {
		if row.SizeUnits == 0 {
			continue
		}
		// Use HasSuffix to avoid leading-dot inconsistency in gosnmp OID values
		if !strings.HasSuffix(row.TypeOID, "25.2.1.4") {
			continue
		}
		totalKB := (row.SizeUnits * row.AllocUnits) / 1024
		usedKB := (row.UsedUnits * row.AllocUnits) / 1024
		partitions = append(partitions, database.DiskPartition{
			Name:    row.Description,
			TotalKB: totalKB,
			UsedKB:  usedKB,
			Type:    "fixed",
		})
	}
	return partitions
}

// pollRamFromHrStorage reads physical RAM total and used from HOST-RESOURCES-MIB.
// This is more reliable than UCD-SNMP-MIB on VMs (Proxmox, KVM, etc.) because
// it reports actual physical memory without swap contamination.
// hrStorageRam type OID: 1.3.6.1.2.1.25.2.1.2
func pollRamFromHrStorage(g *gosnmp.GoSNMP) (totalKB, usedKB int64, ok bool) {
	const hrStorageRamType = ".1.3.6.1.2.1.25.2.1.2"

	type ramRow struct {
		typeOID    string
		allocUnits int64
		sizeUnits  int64
		usedUnits  int64
	}
	rows := map[string]*ramRow{}

	walk := func(oid string, fn func(idx string, pdu gosnmp.SnmpPDU)) {
		_ = g.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
			name := strings.TrimPrefix(pdu.Name, ".")
			idx := strings.TrimPrefix(name, oid+".")
			if _, ok := rows[idx]; !ok {
				rows[idx] = &ramRow{}
			}
			fn(idx, pdu)
			return nil
		})
	}

	walk(hrStorageType, func(idx string, pdu gosnmp.SnmpPDU) {
		// gosnmp returns OID values as string, with or without leading dot
		switch v := pdu.Value.(type) {
		case string:
			rows[idx].typeOID = v
		case []byte:
			rows[idx].typeOID = string(v)
		default:
			rows[idx].typeOID = fmt.Sprintf("%v", pdu.Value)
		}
	})
	walk(hrStorageAllocationUnits, func(idx string, pdu gosnmp.SnmpPDU) {
		rows[idx].allocUnits = toInt64(pdu.Value)
	})
	walk(hrStorageSize, func(idx string, pdu gosnmp.SnmpPDU) {
		rows[idx].sizeUnits = toInt64(pdu.Value)
	})
	walk(hrStorageUsed, func(idx string, pdu gosnmp.SnmpPDU) {
		rows[idx].usedUnits = toInt64(pdu.Value)
	})

	// Debug: log all type OIDs found (helps diagnose OID format issues)
	for idx, row := range rows {
		logger.Infof("hrStorage[%s] type=%q allocUnits=%d sizeUnits=%d usedUnits=%d",
			idx, row.typeOID, row.allocUnits, row.sizeUnits, row.usedUnits)
	}

	for _, row := range rows {
		// hrStorageRam type ends with .25.2.1.2
		if strings.HasSuffix(row.typeOID, "25.2.1.2") && row.sizeUnits > 0 {
			totalKB = (row.sizeUnits * row.allocUnits) / 1024
			usedKB  = (row.usedUnits * row.allocUnits) / 1024
			return totalKB, usedKB, true
		}
	}
	return 0, 0, false
}

// ─── Network Interfaces ───────────────────────────────────────────────────────

func pollNetInterfaces(g *gosnmp.GoSNMP) []database.NetInterface {
	type rawIf struct {
		Name    string
		RxBytes int64
		TxBytes int64
		Speed   int64
	}
	ifaces := map[string]*rawIf{}

	walkIF := func(oid string, fn func(idx string, pdu gosnmp.SnmpPDU)) {
		_ = g.Walk(oid, func(pdu gosnmp.SnmpPDU) error {
			name := strings.TrimPrefix(pdu.Name, ".")
			idx := strings.TrimPrefix(name, oid+".")
			if _, ok := ifaces[idx]; !ok {
				ifaces[idx] = &rawIf{}
			}
			fn(idx, pdu)
			return nil
		})
	}

	walkIF(oidIfDescr, func(idx string, pdu gosnmp.SnmpPDU) {
		if b, ok := pdu.Value.([]byte); ok {
			ifaces[idx].Name = string(b)
		}
	})
	walkIF(oidIfInOctets, func(idx string, pdu gosnmp.SnmpPDU) {
		ifaces[idx].RxBytes = toInt64(pdu.Value)
	})
	walkIF(oidIfOutOctets, func(idx string, pdu gosnmp.SnmpPDU) {
		ifaces[idx].TxBytes = toInt64(pdu.Value)
	})
	walkIF(oidIfSpeed, func(idx string, pdu gosnmp.SnmpPDU) {
		ifaces[idx].Speed = toInt64(pdu.Value) / 1_000_000 // bps → Mbps
	})

	var result []database.NetInterface
	for _, iface := range ifaces {
		if iface.Name == "" || iface.Name == "lo" {
			continue // skip loopback
		}
		result = append(result, database.NetInterface{
			Name:    iface.Name,
			RxBytes: iface.RxBytes,
			TxBytes: iface.TxBytes,
			Speed:   iface.Speed,
		})
	}
	return result
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func toFloat(v interface{}) float64 {
	switch val := v.(type) {
	case uint:
		return float64(val)
	case uint32:
		return float64(val)
	case uint64:
		return float64(val)
	case int:
		return float64(val)
	case int64:
		return float64(val)
	}
	return 0
}

func toInt64(v interface{}) int64 {
	switch val := v.(type) {
	case uint:
		return int64(val)
	case uint32:
		return int64(val)
	case uint64:
		return int64(val)
	case int:
		return int64(val)
	case int64:
		return val
	}
	return 0
}

func formatKB(kb int64) string {
	if kb >= 1024*1024 {
		return fmt.Sprintf("%.1fGB", float64(kb)/1024/1024)
	}
	if kb >= 1024 {
		return fmt.Sprintf("%.1fMB", float64(kb)/1024)
	}
	return fmt.Sprintf("%dKB", kb)
}
