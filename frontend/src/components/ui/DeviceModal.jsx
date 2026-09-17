import { useState, useEffect } from 'react'
import Modal from './Modal'
import { devicesService } from '../../services/devices.service'
import api from '../../services/api'
import { toast } from '../../utils/toast'

import { Upload } from 'lucide-react'
import CustomSelect from './CustomSelect'

const EMPTY_FORM = {
  name: '', ip_address: '', has_ip: true, type: 'router', device_role: 'infrastructure', vendor: 'generic',
  snmp_enabled: false, snmp_community: '', snmp_version: 'v2c',
  location: '', description: '', is_active: true,
  icon_file: null,
  credentials: {
    mikrotik: { api_user: '', api_pass: '', api_port: 8728 },
    cisco:    { ssh_user: '', ssh_pass: '', enable_pass: '', ssh_port: 22 },
  },
}

export default function DeviceModal({ open, onClose, editTarget, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deviceTypes, setDeviceTypes] = useState([])

  useEffect(() => {
    // Fetch device types dynamically
    api.get('/api/device_types').then(res => {
      setDeviceTypes(res.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({ ...EMPTY_FORM, ...editTarget, has_ip: !!editTarget.ip_address, type: editTarget.type?.toLowerCase() || 'router' })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, editTarget])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    const isMultipart = !!form.icon_file;
    let payload = form;

    if (isMultipart) {
      payload = new FormData();
      Object.keys(form).forEach(key => {
        if (key === 'credentials') {
          Object.keys(form.credentials).forEach(vendor => {
            Object.keys(form.credentials[vendor]).forEach(credKey => {
              payload.append(`credentials[${vendor}][${credKey}]`, form.credentials[vendor][credKey]);
            });
          });
        } else if (key === 'icon_file') {
          if (form.icon_file) {
            payload.append('icon_file', form.icon_file);
          }
        } else {
          payload.append(key, form[key] === null ? '' : form[key]);
        }
      });
      payload.set('snmp_enabled', form.snmp_enabled ? 1 : 0);
      payload.set('is_active', form.is_active ? 1 : 0);
    }
    
    try {
      if (editTarget) {
        if (isMultipart) {
          payload.append('_method', 'PUT');
          await api.post(`/api/devices/${editTarget.id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } })
        } else {
          await devicesService.update(editTarget.id, form)
        }
        toast.success(`Device "${form.name}" updated.`)
      } else {
        if (isMultipart) {
          await api.post('/api/devices', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
        } else {
          await devicesService.create(form)
        }
        toast.success(`Device "${form.name}" added.`)
      }
      onSuccess?.()
      onClose()
    } catch {
      // toast error is usually handled by interceptor
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) onClose() }}
      title={editTarget ? `Edit: ${editTarget?.name}` : 'Add New Device'}
      description={editTarget ? 'Update device configuration.' : 'Register a new network device.'}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *" required>
            <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Core-Router-1" required />
          </Field>
          
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">
                IP Address {form.has_ip && <span className="text-rose-500">*</span>}
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={!form.has_ip} onChange={e => {
                  setForm(f => ({ ...f, has_ip: !e.target.checked, ip_address: e.target.checked ? '' : f.ip_address }))
                }} className="rounded w-3 h-3 border-slate-300" />
                Tanpa IP (Pasif)
              </label>
            </div>
            {form.has_ip ? (
              <Input value={form.ip_address} onChange={v => setForm(f => ({ ...f, ip_address: v }))} placeholder="192.168.1.1" required disabled={!!editTarget} />
            ) : (
              <div className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed">
                Tidak ada (Perangkat Pasif)
              </div>
            )}
          </div>

          <Field label="Type">
            <CustomSelect
              value={form.type}
              onChange={v => setForm({ ...form, type: v })}
              options={deviceTypes.length > 0 ? deviceTypes.map(t => ({ label: t.label, value: t.name })) : [{ label: 'Router', value: 'router' }]}
            />
          </Field>
          <Field label="Role">
            <Select value={form.device_role} onChange={v => setForm(f => ({ ...f, device_role: v }))} options={['infrastructure','end_user']} />
          </Field>
          <Field label="Vendor">
            <Select value={form.vendor} onChange={v => setForm(f => ({ ...f, vendor: v }))} options={['mikrotik','cisco','generic','server']} />
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

        <div className="flex flex-col mb-4">
          <label className="text-xs font-semibold text-slate-600 mb-1.5">Custom Icon / Photo (Optional)</label>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".svg,.png,.jpg,.jpeg"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={e => setForm(f => ({ ...f, icon_file: e.target.files[0] }))}
            />
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <Upload size={20} className="text-slate-400 mb-2" />
              <span className="text-sm font-medium text-indigo-600">
                {form.icon_file ? form.icon_file.name : 'Upload File Ikon'}
              </span>
              <span className="text-xs text-slate-500 mt-1">Maks. 2MB. Override the default type icon.</span>
            </div>
          </div>
        </div>

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
                    autoComplete="off"
                    value={form.credentials?.mikrotik?.api_user ?? ''}
                    onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, mikrotik: { ...f.credentials?.mikrotik, api_user: v } } }))}
                    placeholder="admin"
                  />
                </Field>
                <Field label="API Password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.credentials?.mikrotik?.api_pass ?? ''}
                    onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, mikrotik: { ...f.credentials?.mikrotik, api_pass: v } } }))}
                    placeholder="••••••••"
                  />
                </Field>
                <Field label="API Port">
                  <Input
                    type="number"
                    autoComplete="off"
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
                    autoComplete="off"
                    value={form.credentials?.cisco?.ssh_user ?? ''}
                    onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, ssh_user: v } } }))}
                    placeholder="admin"
                  />
                </Field>
                <Field label="SSH Password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.credentials?.cisco?.ssh_pass ?? ''}
                    onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, ssh_pass: v } } }))}
                    placeholder="••••••••"
                  />
                </Field>
                <Field label="Enable Password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.credentials?.cisco?.enable_pass ?? ''}
                    onChange={v => setForm(f => ({ ...f, credentials: { ...f.credentials, cisco: { ...f.credentials?.cisco, enable_pass: v } } }))}
                    placeholder="(optional)"
                  />
                </Field>
                <Field label="SSH Port">
                  <Input
                    type="number"
                    autoComplete="off"
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
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 disabled:opacity-60 transition">
            {saving ? (form.icon_file ? 'Processing Image AI…' : 'Saving…') : editTarget ? 'Save Changes' : 'Add Device'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

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
  const formattedOptions = options.map(o => ({ 
    label: String(o).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
    value: o 
  }))
  return <CustomSelect value={value} onChange={onChange} options={formattedOptions} />
}
