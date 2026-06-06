import axios from 'axios'
import { env } from '../config/env'
import { supabase } from '../lib/supabase'
import type { AppNotification } from '../types/notification'

const client = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const notificationsApi = {
  list: (skip = 0, take = 40) =>
    client.get<AppNotification[]>('/notifications', { params: { skip, take } }),

  unreadCount: () =>
    client.get<{ count: number }>('/notifications/unread-count'),

  markRead: (ids?: string[]) =>
    client.patch<{ ok: boolean }>(
      '/notifications/mark-read',
      ids?.length ? { ids } : {},
    ),
}

export default notificationsApi
