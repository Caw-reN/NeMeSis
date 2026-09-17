import axios from 'axios'
import { toast } from '../utils/toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  timeout: 15000,
})

// ── Request interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nms_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: global error handling ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error / timeout
      toast.error('Network error — cannot reach the server. Check your connection.')
      return Promise.reject(error)
    }

    const { status, data } = error.response

    switch (status) {
      case 401:
        // Token expired or invalid — force logout
        localStorage.removeItem('nms_token')
        localStorage.removeItem('nms_user')
        toast.warning('Session expired. Please log in again.')
        window.location.href = '/login'
        break

      case 403:
        toast.error('Access denied — you do not have permission for this action.')
        break

      case 422: {
        // Laravel validation errors: { message: '...', errors: { field: [msgs] } }
        const firstError = data?.errors
          ? Object.values(data.errors).flat()[0]
          : data?.message ?? 'Validation failed.'
        toast.error(firstError)
        break
      }

      case 404:
        // Some endpoints handle their own 404 (e.g. metrics panels with empty state UI)
        if (!error.config?._skipGlobalError) {
          toast.warning('Resource not found.')
        }
        break

      case 500:
      case 502:
      case 503:
        toast.error('Server error — please try again later or check the backend logs.')
        break

      default:
        toast.error(data?.message ?? `Unexpected error (${status}).`)
    }

    return Promise.reject(error)
  }
)

export default api
