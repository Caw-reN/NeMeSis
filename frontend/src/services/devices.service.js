import api from './api'

export const devicesService = {
  getAll: (params = {}) => api.get('/api/devices', { params }).then(r => r.data),
  getOne: (id)           => api.get(`/api/devices/${id}`).then(r => r.data),
  create: (data)         => api.post('/api/devices', data).then(r => r.data),
  update: (id, data)     => api.put(`/api/devices/${id}`, data).then(r => r.data),
  remove: (id)           => api.delete(`/api/devices/${id}`).then(r => r.data),
  getLogs: (id, params)  => api.get(`/api/devices/${id}/logs`, { params }).then(r => r.data),
}
