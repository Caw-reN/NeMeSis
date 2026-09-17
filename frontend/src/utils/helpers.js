/**
 * Format latency in ms to a display string.
 */
export const formatLatency = (ms) => {
  if (ms === null || ms === undefined) return 'N/A'
  if (ms < 1) return '< 1ms'
  return `${ms.toFixed(1)}ms`
}

/**
 * Human-readable time difference (e.g., "3 minutes ago").
 */
export const timeAgo = (dateString) => {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date) / 1000)
  if (seconds < 60)  return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Capitalize first letter.
 */
export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

/**
 * Map vendor key to display label.
 */
export const vendorLabel = (vendor) => {
  const map = { mikrotik: 'Mikrotik', cisco: 'Cisco', generic: 'Generic', server: 'Linux / VPS' }
  return map[vendor] ?? capitalize(vendor)
}

/**
 * Map device type to display label.
 */
export const typeLabel = (type) => {
  const map = {
    router:   'Router',
    switch:   'Switch',
    server:   'Server',
    ap:       'Access Point',
    firewall: 'Firewall',
    other:    'Other',
  }
  return map[type] ?? capitalize(type)
}

/**
 * Get Tailwind color classes for a device status.
 */
export const statusColors = (status) => {
  const map = {
    up:      { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    down:    { text: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
    unknown: { text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200',   dot: 'bg-slate-400'   },
  }
  return map[status] ?? map.unknown
}
