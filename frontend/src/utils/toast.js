/**
 * toast.js — Global toast utility
 *
 * Used by Axios interceptors and any module outside of React tree.
 * The ToastContainer component registers itself as the callback handler.
 *
 * Usage (anywhere in the app):
 *   import { toast } from '@/utils/toast'
 *   toast.error('Something went wrong')
 *   toast.success('Device added!')
 */

let _handler = null

export const registerToastHandler = (handler) => {
  _handler = handler
}

export const unregisterToastHandler = () => {
  _handler = null
}

const dispatch = (type, message, opts = {}) => {
  if (_handler) {
    const id = opts.id ?? (Date.now() + Math.random())
    _handler({ type, message, id })
    return id
  } else {
    console[type === 'error' ? 'error' : 'log'](`[Toast ${type}]`, message)
    return null
  }
}

export const toast = {
  success: (message, opts)  => dispatch('success', message, opts),
  error:   (message, opts)  => dispatch('error',   message, opts),
  warning: (message, opts)  => dispatch('warning', message, opts),
  info:    (message, opts)  => dispatch('info',    message, opts),
  // loading() returns an id that can be passed to success/error as { id } to replace it
  loading: (message, opts)  => dispatch('loading', message, opts),
  dismiss: (id)             => { if (_handler) _handler({ type: 'dismiss', id }) },
}
