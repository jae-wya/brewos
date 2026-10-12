import axios from 'axios'
import { getSession, clearSession } from './session'
import { MenuItem } from '../types'

// No business id anywhere in the frontend: every route gets it from the
// session token on the server (backend app/security.py).
export const API_BASE = 'https://brewos-api.onrender.com'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 35_000,
})

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

  const token = getSession()?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// A 401 anywhere except the login call itself means the session is missing
// or expired: drop it and go to the login screen, coming back here after.
function handleUnauthorized(error: any) {
  const isLoginCall = String(error.config?.url ?? '').startsWith('/auth/')
  if (error.response?.status !== 401 || isLoginCall) return
  clearSession()
  if (window.location.pathname !== '/login') {
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.assign(`/login?next=${next}`)
  }
}

api.interceptors.response.use(
  response => {
    clearTimeout((response.config as any)._wakeTimer)
    if (_waking) { _waking = false; _wakeListeners.forEach(fn => fn(false)) }
    return response
  },
  error => {
    clearTimeout((error.config as any)?._wakeTimer)
    if (_waking) { _waking = false; _wakeListeners.forEach(fn => fn(false)) }
    handleUnauthorized(error)
    return Promise.reject(error)
  }
)

// The server's `detail` is written to be shown to her as-is.
export function errorMessage(error: any, fallback = "Something went wrong. Please try again."): string {
  if (!error?.response) return "Couldn't reach the server. Check your connection and try again."
  const detail = error.response.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

export const authApi = {
  ownerLogin: (email: string, password: string) =>
    api.post('/auth/owner-login', { email, password }).then(r => r.data),
}

export const menuApi = {
  // Everything, turned-off items and add-ons included; see keys.menu.
  getMenu: () => api.get('/menu', { params: { include_all: true } }).then(r => r.data),
  // Send the value we want, not "flip": a retried request then can't undo itself.
  setItemAvailable: (itemId: string, isAvailable: boolean) =>
    api.patch(`/menu/items/${itemId}/toggle`, { is_available: isAvailable })
      .then(r => r.data as { id: string, is_available: boolean }),
  setOptionAvailable: (optionId: string, isAvailable: boolean) =>
    api.patch(`/menu/modifier-options/${optionId}/toggle`, { is_available: isAvailable })
      .then(r => r.data as { id: string, is_available: boolean }),
  // Prices go as the typed string; the server validates and rounds nothing.
  createItem: (body: ItemFields) =>
    api.post('/menu/items', body).then(r => r.data as MenuItem),
  updateItem: (itemId: string, body: Partial<ItemFields>) =>
    api.patch(`/menu/items/${itemId}`, body).then(r => r.data as MenuItem),
  deleteItem: (itemId: string) =>
    api.delete(`/menu/items/${itemId}`).then(r => r.data),
  restoreItem: (itemId: string) =>
    api.post(`/menu/items/${itemId}/restore`).then(r => r.data as MenuItem),
}

export interface ItemFields {
  name: string
  base_price: string
  category_id: string
  modifier_ids: string[]
}

export const ordersApi = {
  getOrders: (status?: string) =>
    api.get('/orders', { params: status ? { status } : {} }).then(r => r.data),
  createOrder: (data: object) =>
    api.post('/orders/', data).then(r => r.data),
  updateStatus: (orderId: string, status: string) =>
    api.patch(`/orders/${orderId}/status`, { status }).then(r => r.data),
  markPaid: (orderId: string) =>
    api.patch(`/orders/${orderId}/payment`).then(r => r.data),
}

// Her settings (Settings page): the Messenger payment-request template and
// her GCash / Maya numbers. Sending messenger_template: null resets it to the
// default; an empty number removes it.
export interface Settings {
  messenger_template: string
  is_default_template: boolean
  default_template: string
  gcash_number: string
  maya_number: string
}
export const settingsApi = {
  get: (): Promise<Settings> => api.get('/settings').then(r => r.data),
  update: (body: { messenger_template?: string | null, gcash_number?: string, maya_number?: string }): Promise<Settings> =>
    api.patch('/settings', body).then(r => r.data),
}

// One day's sales. No date: today in the café's timezone (the server decides).
export const salesApi = {
  getDay: (date?: string): Promise<SalesDay> =>
    api.get('/sales', { params: date ? { date } : {} }).then(r => r.data),
}

export interface SalesDay {
  date: string      // YYYY-MM-DD, the day shown
  today: string     // YYYY-MM-DD, today in the café's timezone
  timezone: string
  revenue: number
  order_count: number
  average_order_value: number
  top_items: { name: string, category: string | null, quantity: number }[]
}

export const queueApi = {
  getQueue: () => api.get('/queue').then(r => r.data),
  getStats: () => api.get('/queue/stats').then(r => r.data),
}
