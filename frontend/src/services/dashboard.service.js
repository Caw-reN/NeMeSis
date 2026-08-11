import api from './api'

export const dashboardService = {
  getSummary: () => api.get('/api/dashboard/summary').then(r => r.data),
}
