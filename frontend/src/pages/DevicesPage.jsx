import { useEffect, useState } from 'react'
import { motion }    from 'framer-motion'
import { Plus, Pencil, Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DataTable     from '../components/ui/DataTable'
import StatusBadge   from '../components/ui/StatusBadge'
import DeviceTypeIcon from '../components/ui/DeviceTypeIcon'
import Modal         from '../components/ui/Modal'
import { devicesService }  from '../services/devices.service'
import { toast }     from '../utils/toast'
import { formatLatency, timeAgo, vendorLabel, typeLabel } from '../utils/helpers'

const EMPTY_FORM = {
  name: '', ip_address: '', type: 'router', vendor: 'generic',
  snmp_enabled: false, snmp_community: '', snmp_version: 'v2c',
  location: '', description: '', is_active: true,
  // Credentials sub-object (encrypted by backend before storage)
  credentials: {
    mikrotik: { api_user: '', api_pass: '', api_port: 8728 },
    cisco:    { ssh_user: '', ssh_pass: '', enable_pass: '', ssh_port: 22 },
  },
}

export default function DevicesPage() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget]     = useState(null)
  const [form, setForm]   = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchDevices = () => {
    setLoading(true)
    devicesService.getAll({ per_page: 100 })
      .then(d => setDevices(d.data ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(fetchDevices, [])

  // Open Add modal
  const openAdd = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  // Open Edit modal
  const openEdit = (device) => {
    setEditTarget(device)
    setForm({ ...EMPTY_FORM, ...device })
    setModalOpen(true)
  }

  // Submit add/edit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editTarget) {
        await devicesService.update(editTarget.id, form)
        toast.success(`Device "${form.name}" updated.`)
      } else {
        await devicesService.create(form)
        toast.success(`Device "${form.name}" added.`)
      }
      setModalOpen(false)
      fetchDevices()
    } finally {
      setSaving(false)
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await devicesService.remove(deleteTarget.id)
      toast.success(`Device "${deleteTarget.name}" deleted.`)
      setDeleteTarget(null)
      fetchDevices()
    } catch {/* handled by interceptor */}
  }

  const columns = [
    {
      key: 'name', label: 'Device',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <DeviceTypeIcon type={row.type} size={15} className="text-slate-600" />
          </div>
          <div>
            <button
              onClick={() => navigate(`/devices/${row.id}`)}
              className="font-semibold text-slate-900 text-sm hover:text-indigo-600 transition flex items-center gap-1 group"
            >
              {row.name}
              <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition" />
            </button>
            <p className="text-xs text-slate-400 font-mono">{row.ip_address}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type', label: 'Type / Vendor',
      render: (_, row) => (
        <div>
          <p className="text-sm text-slate-700">{typeLabel(row.type)}</p>
          <p className="text-xs text-slate-400">{vendorLabel(row.vendor)}</p>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'latency_ms', label: 'Latency',
      render: (v) => <span className="text-sm font-mono text-slate-600">{formatLatency(v)}</span>,
    },
    {
      key: 'last_seen_at', label: 'Last Seen',
      render: (v) => <span className="text-sm text-slate-500">{timeAgo(v)}</span>,
    },
    {
      key: 'id', label: '',
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <Pencil size={14} />
          </button>
          <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition">
            <Trash2 size={14} />
          </button>
        </div>
      ),
      className: 'w-16',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-4"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-display font-bold text-slate-900">All Devices</h2>
          <p className="text-xs text-slate-400">{devices.length} total</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={fetchDevices} className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-xl px-3 py-2 hover:bg-slate-50 transition">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 text-sm text-white bg-zinc-900 hover:bg-zinc-700 rounded-xl px-3 py-2 transition">
            <Plus size={14} /> Add Device
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={devices}
        loading={loading}
        searchPlaceholder="Search by name, IP, or location..."
        emptyMessage="No devices found. Click 'Add Device' to get started."
      />

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editTarget ? `Edit: ${editTarget.name}` : 'Add New Device'}
        description={editTarget ? 'Update device configuration.' : 'Register a new network device.'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *" required>
              <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Core-Router-1" required />
            </Field>
            <Field label="IP Address *" required>
              <Input value={form.ip_address} onChange={v => setForm(f => ({ ...f, ip_address: v }))} placeholder="192.168.1.1" required disabled={!!editTarget} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} options={['router','switch','server','ap','firewall','other']} />
            </Field>
            <Field label="Vendor">
              <Select value={form.vendor} onChange={v => setForm(f => ({ ...f, vendor: v }))} options={['mikrotik','cisco','generic']} />
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="Server Room A" />
            </Field>
            <Field label="SNMP Version">
              <Select value={form.snmp_version} onChange={v => setForm(f => ({ ...f, snmp_version: v }))} options={['v1','v2c','v3']} />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.snmp_enabled} onChange={e => setForm(f => ({ ...f, snmp_enabled: e.target.checked }))} className="rounded" />
              Enable SNMP
            </label>
          </div>

          {form.snmp_enabled && (
            <Field label="SNMP Community">
              <Input value={form.snmp_community} onChange={v => setForm(f => ({ ...f, snmp_community: v }))} placeholder="public" />
            </Field>
          )}

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition resize-none"
              placeholder="Optional notes..."
            />
          </Field>

          {/* ── Credential Section (vendor-specific) ── */}
          {(form.vendor === 'mikrotik' || form.vendor === 'cisco') && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                🔐 Device Credentials <span className="font-normal text-amber-600">(encrypted at rest)</span>
              </p>

              {form.vendor === 'mikrotik' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="API Username">
                    <Input
                      value={form.credentials?.mikrotik?.api_user ?? ''}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, mikrotik: { ...f.credentials?.mikrotik, api_user: v } } }))}
                      placeholder="admin"
                    />
                  </Field>
                  <Field label="API Password">
                    <Input
                      type="password"
                      value={form.credentials?.mikrotik?.api_pass ?? ''}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, mikrotik: { ...f.credentials?.mikrotik, api_pass: v } } }))}
                      placeholder="••••••••"
                    />
                  </Field>
                  <Field label="API Port">
                    <Input
                      type="number"
                      value={form.credentials?.mikrotik?.api_port ?? 8728}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, mikrotik: { ...f.credentials?.mikrotik, api_port: parseInt(v) } } }))}
                      placeholder="8728"
                    />
                  </Field>
                </div>
              )}

              {form.vendor === 'cisco' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SSH Username">
                    <Input
                      value={form.credentials?.cisco?.ssh_user ?? ''}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, ssh_user: v } } }))}
                      placeholder="admin"
                    />
                  </Field>
                  <Field label="SSH Password">
                    <Input
                      type="password"
                      value={form.credentials?.cisco?.ssh_pass ?? ''}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, ssh_pass: v } } }))}
                      placeholder="••••••••"
                    />
                  </Field>
                  <Field label="Enable Password">
                    <Input
                      type="password"
                      value={form.credentials?.cisco?.enable_pass ?? ''}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, enable_pass: v } } }))}
                      placeholder="(optional)"
                    />
                  </Field>
                  <Field label="SSH Port">
                    <Input
                      type="number"
                      value={form.credentials?.cisco?.ssh_port ?? 22}
                      onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, ssh_port: parseInt(v) } } }))}
                      placeholder="22"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 disabled:opacity-60 transition">
              {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Device'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Device?" maxWidth="max-w-sm">
        <p className="text-sm text-slate-500 mb-5">
          Are you sure you want to delete <strong className="text-slate-900">{deleteTarget?.name}</strong>?
          This will also remove all its logs and topology links.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition">
            Delete
          </button>
        </div>
      </Modal>
    </motion.div>
  )
}

// ── Small form helpers ─────────────────────────────────────────────────────────
function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, ...props }) {
  return (
    <input
      {...props}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
