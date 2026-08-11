/**
 * InterfaceTable — generik untuk Mikrotik dan Cisco interfaces.
 *
 * Props:
 *   interfaces  — array of interface objects
 *   vendor      — 'mikrotik' | 'cisco'
 */
export default function InterfaceTable({ interfaces = [], vendor }) {
  if (!interfaces.length) {
    return <p className="text-sm text-slate-400 py-4 text-center">No interface data available.</p>
  }

  const isMikrotik = vendor === 'mikrotik'

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <Th>Interface</Th>
            <Th>Status</Th>
            {isMikrotik ? (
              <>
                <Th>Type</Th>
                <Th>Rx (bps)</Th>
                <Th>Tx (bps)</Th>
                <Th>Rx Packets</Th>
                <Th>Tx Packets</Th>
              </>
            ) : (
              <>
                <Th>Admin</Th>
                <Th>Protocol</Th>
                <Th>In (bps)</Th>
                <Th>Out (bps)</Th>
                <Th>Errors In</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {interfaces.map((iface, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              {isMikrotik ? (
                <MikrotikRow iface={iface} />
              ) : (
                <CiscoRow iface={iface} />
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MikrotikRow({ iface }) {
  const isUp = iface.running === 'true' || iface.disabled === 'false'
  return (
    <>
      <Td className="font-mono font-semibold text-slate-800">{iface.name}</Td>
      <Td><StatusDot up={iface.running === 'true' && iface.disabled !== 'true'} /></Td>
      <Td className="text-slate-500">{iface.type ?? '—'}</Td>
      <Td className="font-mono">{fmt(iface['rx-bits-per-second'])}</Td>
      <Td className="font-mono">{fmt(iface['tx-bits-per-second'])}</Td>
      <Td className="font-mono">{fmt(iface['rx-packet'])}</Td>
      <Td className="font-mono">{fmt(iface['tx-packet'])}</Td>
    </>
  )
}

function CiscoRow({ iface }) {
  const isUp = iface.admin_status === 'up' && iface.line_protocol === 'up'
  return (
    <>
      <Td className="font-mono font-semibold text-slate-800">{iface.name}</Td>
      <Td><StatusDot up={isUp} /></Td>
      <Td className="text-slate-500">{iface.admin_status ?? '—'}</Td>
      <Td className="text-slate-500">{iface.line_protocol ?? '—'}</Td>
      <Td className="font-mono">{fmtBps(iface.input_bps)}</Td>
      <Td className="font-mono">{fmtBps(iface.output_bps)}</Td>
      <Td className="font-mono text-rose-600">{fmt(iface.errors_in)}</Td>
    </>
  )
}

function StatusDot({ up }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
      <span className={`w-2 h-2 rounded-full ${up ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'}`} />
      {up ? 'UP' : 'DOWN'}
    </span>
  )
}

function Th({ children }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children, className = '' }) {
  return (
    <td className={`px-4 py-2.5 text-slate-700 whitespace-nowrap ${className}`}>
      {children}
    </td>
  )
}

// Format number with K/M suffix
function fmt(val) {
  if (val === undefined || val === null) return '—'
  const n = typeof val === 'string' ? parseInt(val, 10) : val
  if (isNaN(n)) return val
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtBps(val) {
  if (val === undefined || val === null) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' Mbps'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + ' Kbps'
  return n + ' bps'
}
