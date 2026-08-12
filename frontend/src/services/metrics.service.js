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
    const { data } = await api.get(`/api/devices/${deviceId}/metrics/cisco`)
    return data
  },
}
