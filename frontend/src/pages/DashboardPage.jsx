import { useEffect, useState } from 'react'
import { motion }  from 'framer-motion'
import { Monitor, CheckCircle2, XCircle, HelpCircle, TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import StatCard    from '../components/ui/StatCard'
import { dashboardService } from '../services/dashboard.service'
import { timeAgo }  from '../utils/helpers'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardService.getSummary()
      .then(setData)
      .finally(() => setLoading(false))

    // Auto-refresh every 60s
    const id = setInterval(() => dashboardService.getSummary().then(setData), 60_000)
    return () => clearInterval(id)
  }, [])

  const s = data?.summary

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      {/* KPI Cards */}
      <section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            index={0}
            label="Total Devices"
            value={s?.total_devices ?? 0}
            icon={<Monitor size={22} />}
            accent="bg-indigo-50"
            iconColor="text-indigo-500"
            loading={loading}
          />
          <StatCard
            index={1}
            label="Devices UP"
            value={s?.up_devices ?? 0}
            icon={<CheckCircle2 size={22} />}
            accent="bg-emerald-50"
            iconColor="text-emerald-500"
            sub="Reachable & responding"
            loading={loading}
          />
          <StatCard
            index={2}
            label="Devices DOWN"
            value={s?.down_devices ?? 0}
            icon={<XCircle size={22} />}
            accent="bg-rose-50"
            iconColor="text-rose-500"
            sub="No ICMP response"
            loading={loading}
          />
          <StatCard
            index={3}
            label="Uptime"
            value={`${s?.uptime_percent ?? 0}%`}
            icon={<TrendingUp size={22} />}
            accent="bg-amber-50"
            iconColor="text-amber-500"
            sub={s?.unknown_devices ? `${s.unknown_devices} unknown` : undefined}
            loading={loading}
          />
        </div>
      </section>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-rose-500" />
            <h2 className="font-display font-bold text-slate-900 text-base">Recent Alerts</h2>
            <span className="ml-auto text-xs text-slate-400">Last 24 hours</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (data?.recent_alerts?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircle2 size={32} className="mb-2 text-emerald-400" />
              <p className="text-sm font-medium">All clear - no alerts in the last 24 hours.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.recent_alerts.map((alert, i) => (
                <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
                  <XCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {alert.device_name} <span className="font-normal text-slate-500">({alert.ip_address})</span>
                    </p>
                    <p className="text-xs text-slate-500">{alert.message}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 ml-auto">{alert.time}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Devices by Type */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Server size={18} className="text-blue-500" />
            <h2 className="font-display font-bold text-slate-900 text-base">Devices by Type</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-8 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data?.devices_by_type?.map((item) => (
                <div key={item.type} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                      {item.icon_svg ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                          <g dangerouslySetInnerHTML={{ __html: item.icon_svg }} />
                        </svg>
                      ) : (
                        <Server size={14} className="text-slate-400" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* System Info */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-indigo-500" />
            <h2 className="font-display font-bold text-slate-900 text-base">System Status</h2>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Last Scan',          value: s?.last_scan_at ? timeAgo(s.last_scan_at) : 'Never' },
              { label: 'SNMP Devices',        value: loading ? '…' : s?.snmp_devices ?? 0 },
              { label: 'Unknown Devices',     value: loading ? '…' : s?.unknown_devices ?? 0 },
              { label: 'Scanner',             value: 'Go Worker - Active' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className="text-sm font-semibold text-slate-800">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  )
}
