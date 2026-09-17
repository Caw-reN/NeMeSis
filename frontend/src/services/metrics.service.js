import api from './api'

/**
 * metricsService — Fase 3a (Read Mode)
 *
 * Fetches real-time metrics from Mikrotik and Cisco devices via Laravel backend.
 * The backend connects to the device and returns parsed JSON.
 *
 * Endpoints:
 *   GET /api/devices/{id}/metrics/mikrotik
 *   GET /api/devices/{id}/metrics/cisco
 */
export const metricsService = {
  /**
   * Fetch Mikrotik device metrics.
   * Returns: system_resources, interfaces, ip_addresses, dhcp_leases, routing_table.
   */
  getMikrotikMetrics: async (deviceId) => {
    const { data } = await api.get(`/api/devices/${deviceId}/metrics/mikrotik`)
    return data
  },

  /**
   * Fetch Cisco device metrics.
   * Returns: version, interface_status, interface_detail, vlan_brief, mac_address_table.
   */
  getCiscoMetrics: async (deviceId) => {
    // Use a short 10s timeout — Cisco SSH can hang if device is offline,
    // and the backend is single-threaded (php artisan serve).
    const { data } = await api.get(`/api/devices/${deviceId}/metrics/cisco`, { timeout: 10_000 })
    return data
  },

  /**
   * Fetch VPS/Linux server metrics (collected by Go worker via SNMP).
   * Returns: system, cpu, memory, disks, network.
   */
  getVpsMetrics: async (deviceId) => {
    const { data } = await api.get(`/api/devices/${deviceId}/metrics/vps`, { _skipGlobalError: true })
    return data
  },
}
