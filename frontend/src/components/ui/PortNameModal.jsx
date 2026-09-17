import { useState, useEffect } from 'react'
import Modal from './Modal'
import { Tag, Loader2 } from 'lucide-react'

export default function PortNameModal({
  open,
  onOpenChange,
  portName,
  currentName,
  onConfirm,
  loading = false,
}) {
  const [name, setName] = useState(currentName || '')

  useEffect(() => {
    if (open) {
      setName(currentName || '')
    }
  }, [open, currentName])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!loading) {
      onConfirm(name)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Port Name"
      description={`Set a description for interface ${portName}.`}
      maxWidth="max-w-md"
    >
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <Tag className="text-indigo-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-bold text-indigo-900">Port Description</h4>
          <p className="text-xs text-indigo-800 mt-1">
            This will update the description of the port on the switch. Leave it blank to remove the name.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Port Name / Description
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="e.g. Uplink to Core"
            className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition bg-white"
            maxLength={255}
          />
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
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 rounded-xl transition disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Save Name
          </button>
        </div>
      </form>
    </Modal>
  )
}
