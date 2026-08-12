import { useEffect, useState } from 'react'
import { devicesService } from '../../services/devices.service'

/**
 * InterfaceSelect
 * Fetches real network interfaces (ether1, Gi0/1, etc.) for a device and shows
 * them as a dropdown. Falls back to a text input if not reachable.
 */
export default function InterfaceSelect({ deviceId, value, onChange, placeholder, size = 'md' }) {
  const [ifaces, setIfaces]   = useState(null)   // null = loading
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deviceId) return
    setLoading(true)
    devicesService.getInterfaces(deviceId)
      .then(data => setIfaces(data.interfaces ?? []))
      .catch(() => setIfaces([]))
      .finally(() => setLoading(false))
  }, [deviceId])

  const selectClass = size === 'sm'
    ? 'w-full text-xs border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white'
    : 'w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white'

  if (loading) {
    return (
      <div className={`${selectClass} text-slate-400 flex items-center gap-2`}>
        <div className="w-3 h-3 border border-slate-300 border-t-indigo-400 rounded-full animate-spin shrink-0" />
        <span className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>Loading interfaces…</span>
      </div>
    )
  }

  if (!ifaces || ifaces.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={selectClass}
      />
    )
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={selectClass + ' cursor-pointer'}
    >
      <option value="">— Select interface —</option>
      {ifaces.map(iface => (
        <option key={iface.name} value={iface.name}>
          {iface.running === true ? '↑' : iface.running === false ? '↓' : '–'}{' '}
          {iface.name}
          {iface.type && iface.type !== 'ether' ? ` (${iface.type})` : ''}
        </option>
      ))}
      <option value="__custom__">✏️ Custom…</option>
    </select>
  )
}
