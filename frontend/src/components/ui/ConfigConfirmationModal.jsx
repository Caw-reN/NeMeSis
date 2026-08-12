import { useState, useEffect } from 'react'
import Modal from './Modal'
import { AlertTriangle, Loader2 } from 'lucide-react'

export default function ConfigConfirmationModal({
  open,
  onOpenChange,
  deviceName,
  actionTitle,
  actionDescription,
  onConfirm,
  loading = false,
}) {
  const [confirmText, setConfirmText] = useState('')
  const isValid = confirmText === deviceName

  // Reset when opening
  useEffect(() => {
    if (open) {
      setConfirmText('')
    }
  }, [open])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isValid && !loading) {
      onConfirm()
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm Configuration Change"
      description="You are about to make changes to a remote device."
      maxWidth="max-w-md"
    >
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-bold text-amber-900">{actionTitle}</h4>
          <p className="text-xs text-amber-800 mt-1">{actionDescription}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Please type <strong className="select-all bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">{deviceName}</strong> to confirm.
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition font-mono"
            placeholder={deviceName}
            disabled={loading}
            autoComplete="off"
            required
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
            disabled={!isValid || loading}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl transition ${
              isValid && !loading
                ? 'bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Execute Action
          </button>
        </div>
      </form>
    </Modal>
  )
}
