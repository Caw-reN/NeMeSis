import api from './api'

export const topologyService = {
  getGraph:    ()           => api.get('/api/topology').then(r => r.data),
  runDiscovery:()           => api.post('/api/topology/discover', {}, { timeout: 120_000 }).then(r => r.data),
  createLink:  (data)       => api.post('/api/topology/links', data).then(r => r.data),
  updateLink:  (id, data)   => api.put(`/api/topology/links/${id}`, data).then(r => r.data),
  deleteLink:  (id)         => api.delete(`/api/topology/links/${id}`).then(r => r.data),
}
