import axios from 'axios'

export const BUSINESS_ID = 'a0000000-0000-0000-0000-000000000001'
export const API_BASE = 'https://brewos-api.onrender.com'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 35_000, // Render free tier can take 30s to wake
})

// Track if we're waiting on a cold start
let _waking = false
let _wakeListeners: Array<(waking: boolean) => void> = []
export function onWakeChange(fn: (waking: boolean) => void) {
  _wakeListeners.push(fn)
  return () => { _wakeListeners = _wakeListeners.filter(l => l !== fn) }
}

api.interceptors.request.use(config => {
  const timer = setTimeout(() => {
    _waking = true
    _wakeListeners.forEach(fn => fn(true))
  }, 3000)
  ;(config as any)._wakeTimer = timer
  return config
})

api.interceptors.response.use(
  response => {
    clearTimeout((response.config as any)._wakeTimer)
    if (_waking) {
      _waking = false
      _wakeListeners.forEach(fn => fn(false))
    }
    return response
  },
  error => {
    clearTimeout((error.config as any)?._wakeTimer)
    if (_waking) {
      _waking = false
      _wakeListeners.forEach(fn => fn(false))
    }
    return Promise.reject(error)
  }
)

export const menuApi = {
  getMenu: () => api.get(`/menu/${BUSINESS_ID}`).then(r => r.data),
  toggleItem: (itemId: string) =>
    api.patch(`/menu/${BUSINESS_ID}/items/${itemId}/toggle`).then(r => r.data),
}

export const ordersApi = {
  getOrders: (status?: string) =>
    api.get(`/orders/${BUSINESS_ID}`, { params: status ? { status } : {} }).then(r => r.data),
  createOrder: (data: object) =>
    api.post('/orders/', data).then(r => r.data),
  updateStatus: (orderId: string, status: string) =>
    api.patch(`/orders/${BUSINESS_ID}/${orderId}/status`, { status }).then(r => r.data),
  markPaid: (orderId: string) =>
    api.patch(`/orders/${BUSINESS_ID}/${orderId}/payment`).then(r => r.data),
}

export const queueApi = {
  getQueue: () => api.get(`/queue/${BUSINESS_ID}`).then(r => r.data),
  getStats: () => api.get(`/queue/${BUSINESS_ID}/stats`).then(r => r.data),
}
