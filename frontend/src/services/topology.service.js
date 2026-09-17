import api from './api'

export const topologyService = {
  getGraph:    ()           => api.get('/api/topology').then(r => r.data),
  runDiscovery:(ipRanges = [], filterType = '') => api.post('/api/topology/discover', { ip_ranges: ipRanges, filter_type: filterType }, { timeout: 120_000 }).then(r => r.data),
  createLink:  (data)       => api.post('/api/topology/links', data).then(r => r.data),
  updateLink:  (id, data)   => api.put(`/api/topology/links/${id}`, data).then(r => r.data),
  deleteLink:  (id)         => api.delete(`/api/topology/links/${id}`).then(r => r.data),
  addShape:    (data)       => api.post('/api/topology/shapes', data).then(r => r.data),
  updateShape: (id, data)   => api.put(`/api/topology/shapes/${id}`, data).then(r => r.data),
  deleteShape: (id)         => api.delete(`/api/topology/shapes/${id}`).then(r => r.data),
  savePositions: (positions) => api.post('/api/topology/positions', { positions }).then(r => r.data),
}
