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

const dispatch = (type, message) => {
  if (_handler) {
    _handler({ type, message, id: Date.now() + Math.random() })
  } else {
    // Fallback: console log if no React handler yet
    console[type === 'error' ? 'error' : 'log'](`[Toast ${type}]`, message)
  }
}

export const toast = {
  success: (message) => dispatch('success', message),
  error:   (message) => dispatch('error',   message),
  warning: (message) => dispatch('warning', message),
  info:    (message) => dispatch('info',    message),
}
