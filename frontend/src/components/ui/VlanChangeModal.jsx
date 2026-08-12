import { useState, useEffect } from 'react'
import Modal from './Modal'
import CustomSelect from './CustomSelect'
import { Network, Loader2 } from 'lucide-react'

export default function VlanChangeModal({
  open,
  onOpenChange,
  portName,
  currentVlan,
  vlans = [],
  onConfirm,
  loading = false,
}) {
  const [mode, setMode] = useState('access')
  const [selectedVlan, setSelectedVlan] = useState('')

  useEffect(() => {
    if (open) {
      if (currentVlan === 'trunk') {
        setMode('trunk')
        setSelectedVlan('')
      } else {
        setMode('access')
        setSelectedVlan(currentVlan || '')
      }
    }
  }, [open, currentVlan])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!loading) {
      const vlanVal = mode === 'access' && selectedVlan ? parseInt(selectedVlan, 10) : null
      onConfirm(mode, vlanVal)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Change Port VLAN"
      description={`Assign a new access VLAN to interface ${portName}.`}
      maxWidth="max-w-md"
    >
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <Network className="text-indigo-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-bold text-indigo-900">VLAN Assignment</h4>
          <p className="text-xs text-indigo-800 mt-1">
            This will change the switchport access mode for this interface. 
            Ensure the selected VLAN is active.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Port Mode
            </label>
            <CustomSelect
              value={mode}
              onChange={setMode}
              disabled={loading}
              options={[
                { value: 'access', label: 'Access' },
                { value: 'trunk', label: 'Trunk' }
              ]}
            />
          </div>

          {mode === 'access' && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Select VLAN
              </label>
              <CustomSelect
                value={selectedVlan ? parseInt(selectedVlan, 10) : ''}
                onChange={(val) => setSelectedVlan(val.toString())}
                disabled={loading}
                placeholder="Select a VLAN..."
                options={vlans.map(v => ({
                  value: v.vlan_id,
                  label: `VLAN ${v.vlan_id} - ${v.name}`
                }))}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={(mode === 'access' && !selectedVlan) || loading}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition ${
              (mode === 'trunk' || selectedVlan) && !loading
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Apply VLAN
          </button>
        </div>
      </form>
    </Modal>
  )
}
