import axios from 'axios'

export const BUSINESS_ID = 'a0000000-0000-0000-0000-000000000001'
export const API_BASE = 'http://127.0.0.1:8000'

const api = axios.create({ baseURL: API_BASE })

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
