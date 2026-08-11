package snmp

import (
	"fmt"
	"time"

	"github.com/gosnmp/gosnmp"

	"github.com/Caw-reN/NeMeSis/worker/internal/database"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

// OID constants for commonly polled MIBs.
const (
	OIDSysDescr  = "1.3.6.1.2.1.1.1.0" // System description (vendor, OS version)
	OIDSysName   = "1.3.6.1.2.1.1.5.0" // Configured hostname
	OIDSysUptime = "1.3.6.1.2.1.1.3.0" // System uptime in timeticks
)

// SysInfo holds the result of a basic SNMP sysInfo poll.
type SysInfo struct {
	IPAddress   string
	SysDescr    string
	SysName     string
	SysUptimeSec uint32
}

// GetSysInfo polls OIDs sysDescr, sysName, and sysUptime from the target device.
// Only called for devices where snmp_enabled = true.
//
// SECURITY NOTE: snmp_community is stored as plaintext in DB — safe because:
// - It is read-only (Read Community, no write access)
// - The Go worker is a trusted internal service inside Docker network
// - Encrypted write credentials are NEVER passed to this package
func GetSysInfo(ip, community, version string) (*SysInfo, error) {
	snmpVersion := gosnmp.Version2c
	if version == "v1" {
		snmpVersion = gosnmp.Version1
	}

	g := &gosnmp.GoSNMP{
		Target:    ip,
		Port:      161,
		Community: community,
		Version:   snmpVersion,
		Timeout:   3 * time.Second,
		Retries:   2,
	}

	if err := g.Connect(); err != nil {
		return nil, fmt.Errorf("SNMP connect error for %s: %w", ip, err)
	}
	defer g.Conn.Close()

	oids := []string{OIDSysDescr, OIDSysName, OIDSysUptime}
	result, err := g.Get(oids)
	if err != nil {
		return nil, fmt.Errorf("SNMP get error for %s: %w", ip, err)
	}

	info := &SysInfo{IPAddress: ip}

	for _, pdu := range result.Variables {
		switch pdu.Name {
		case "."+OIDSysDescr:
			info.SysDescr = gosnmp.ToBigInt(pdu.Value).String()
			if b, ok := pdu.Value.([]byte); ok {
				info.SysDescr = string(b)
			}
		case "."+OIDSysName:
			if b, ok := pdu.Value.([]byte); ok {
				info.SysName = string(b)
			}
		case "."+OIDSysUptime:
			if v, ok := pdu.Value.(uint32); ok {
				info.SysUptimeSec = v / 100 // TimeTicks are in hundredths of a second
			}
		}
	}

	return info, nil
}

// PollDevice polls SNMP for the given device and logs the result.
// Called after a successful ping to enrich device information.
func PollDevice(device database.DeviceRecord) {
	if !device.SNMPEnabled || !device.SNMPCommunity.Valid {
		return
	}

	info, err := GetSysInfo(device.IPAddress, device.SNMPCommunity.String, device.SNMPVersion)
	if err != nil {
		logger.Warnf("SNMP poll failed for %s (%s): %v", device.Name, device.IPAddress, err)
		return
	}

	logger.Infof("📡 SNMP %s (%s) — SysName: %q | Uptime: %ds",
		device.Name, device.IPAddress, info.SysName, info.SysUptimeSec)

	// Log SNMP poll result to DB
	metadata := fmt.Sprintf(
		`{"sys_descr": %q, "sys_name": %q, "uptime_sec": %d}`,
		info.SysDescr, info.SysName, info.SysUptimeSec,
	)
	msg := fmt.Sprintf("SNMP poll berhasil: SysName=%q, Uptime=%ds", info.SysName, info.SysUptimeSec)

	if err := database.InsertDeviceLog(device.ID, "scan", msg, &metadata); err != nil {
		logger.Errorf("Failed to log SNMP result for device %d: %v", device.ID, err)
	}
}
