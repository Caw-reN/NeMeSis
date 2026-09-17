import api from './api'

export const areasService = {
  getAll: () => api.get('/api/areas').then(res => res.data),
  getOne: (id) => api.get(`/api/areas/${id}`).then(res => res.data),
  create: (data) => api.post('/api/areas', data).then(res => res.data),
  update: (id, data) => api.put(`/api/areas/${id}`, data).then(res => res.data),
  remove: (id) => api.delete(`/api/areas/${id}`),
  uploadImage: async (id, file) => {
    const formData = new FormData()
    formData.append('image', file)
    return api.post(`/api/areas/${id}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data)
  },
}
