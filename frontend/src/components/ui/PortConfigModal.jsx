import { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomSelect from './CustomSelect'
import { Network, Tag, Loader2 } from 'lucide-react'

export default function PortConfigModal({
  open,
  onOpenChange,
  portName,
  currentName,
  currentVlan,
  vlans = [],
  onConfirm,
  loading = false,
}) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState('access')
  const [selectedVlan, setSelectedVlan] = useState('1')

  useEffect(() => {
    if (open) {
      setName(currentName || '')
      if (currentVlan && currentVlan !== 'trunk') {
        setMode('access')
        setSelectedVlan(currentVlan.toString())
      } else {
        setMode('trunk')
        setSelectedVlan('1')
      }
    }
  }, [open, currentName, currentVlan])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!loading) {
      onConfirm({
        name,
        mode,
        vlanId: mode === 'access' ? parseInt(selectedVlan, 10) : null
      })
    }
  }

  // Convert VLANs for CustomSelect
  const vlanOptions = vlans.map(v => ({
    value: v.vlan_id.toString(),
    label: `${v.vlan_id} - ${v.name}`
  }))

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configure Port"
      description={`Update settings for interface ${portName}.`}
      maxWidth="max-w-md"
    >
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <Network className="text-indigo-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-bold text-indigo-900">Port Configuration</h4>
          <p className="text-xs text-indigo-800 mt-1">
            This will update the mode, VLAN assignment, and description of the port on the switch. 
            Leave the description blank to remove it.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name / Description */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Tag size={14} className="text-slate-400" />
            Port Description
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="e.g. Uplink to Core"
            className="w-full text-sm font-medium border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition bg-white text-slate-700"
            maxLength={255}
          />
        </div>

        {/* Port Mode */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Network size={14} className="text-slate-400" />
            Switchport Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('access')}
              className={`flex items-center justify-center py-2.5 px-4 rounded-xl border text-sm font-bold transition-colors ${
                mode === 'access' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Access
            </button>
            <button
              type="button"
              onClick={() => setMode('trunk')}
              className={`flex items-center justify-center py-2.5 px-4 rounded-xl border text-sm font-bold transition-colors ${
                mode === 'trunk' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Trunk
            </button>
          </div>
        </div>

        {/* Access VLAN Select */}
        {mode === 'access' && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Access VLAN
            </label>
            {vlans.length > 0 ? (
              <CustomSelect
                value={selectedVlan}
                onChange={setSelectedVlan}
                options={vlanOptions}
                placeholder="Select a VLAN..."
              />
            ) : (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                No VLANs discovered on this device.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || (mode === 'access' && vlans.length === 0)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 rounded-xl transition disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Apply Changes
          </button>
        </div>
      </form>
    </Modal>
  )
}
