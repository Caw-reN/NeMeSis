import api from './api'

const TOKEN_KEY = 'nms_token'
const USER_KEY  = 'nms_user'

export const authService = {
  async login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  },

  async logout() {
    try {
      await api.post('/api/auth/logout')
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }
  },

  async me() {
    const { data } = await api.get('/api/auth/me')
    return data
  },

  getToken: ()  => localStorage.getItem(TOKEN_KEY),
  getUser:  ()  => JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'),
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),

  clearSession() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
