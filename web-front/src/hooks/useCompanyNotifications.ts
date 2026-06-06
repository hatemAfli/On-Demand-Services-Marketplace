import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import notificationsApi from '../services/notificationsApi'
import type { AppNotification } from '../types/notification'
import { useAuthStore } from '../stores/authStore'

const PAGE_SIZE = 30

function normalizeRows(data: unknown): AppNotification[] {
  if (!Array.isArray(data)) return []
  return data
    .map((row) => normalizeNotification(row))
    .filter((x): x is AppNotification => x !== null)
}

function normalizeNotification(raw: unknown): AppNotification | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.type !== 'string') return null
  return {
    id: r.id,
    type: r.type as AppNotification['type'],
    title: typeof r.title === 'string' ? r.title : '',
    body: typeof r.body === 'string' ? r.body : '',
    data:
      r.data && typeof r.data === 'object' && !Array.isArray(r.data)
        ? (r.data as Record<string, unknown>)
        : null,
    isRead: Boolean(r.isRead),
    readAt: typeof r.readAt === 'string' ? r.readAt : null,
    createdAt:
      typeof r.createdAt === 'string'
        ? r.createdAt
        : r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : new Date().toISOString(),
  }
}

export function useCompanyNotifications(enabled = true) {
  const userId = useAuthStore((s) => s.user?.id)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const notificationsRef = useRef<AppNotification[]>([])
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    notificationsRef.current = notifications
  }, [notifications])

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0)
      return
    }
    try {
      const res = await notificationsApi.unreadCount()
      setUnreadCount(res.data?.count ?? 0)
    } catch {
      setUnreadCount(0)
    }
  }, [userId])

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setHasMore(false)
      return
    }
    setLoading(true)
    setHasMore(true)
    try {
      const [listRes] = await Promise.all([
        notificationsApi.list(0, PAGE_SIZE),
        refreshUnreadCount(),
      ])
      const rows = normalizeRows(listRes.data)
      setNotifications(rows)
      setHasMore(rows.length >= PAGE_SIZE)
    } catch {
      setNotifications([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [userId, refreshUnreadCount])

  const loadMoreNotifications = useCallback(async () => {
    if (!userId || loading || loadingMoreRef.current || loadingMore || !hasMore) {
      return
    }
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const skip = notificationsRef.current.length
      const listRes = await notificationsApi.list(skip, PAGE_SIZE)
      const rows = normalizeRows(listRes.data)
      if (rows.length === 0) {
        setHasMore(false)
        return
      }
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id))
        const merged = [...prev]
        for (const row of rows) {
          if (!seen.has(row.id)) merged.push(row)
        }
        return merged
      })
      setHasMore(rows.length >= PAGE_SIZE)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [userId, loading, loadingMore, hasMore])

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      await notificationsApi.markRead(ids)
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)),
      )
      void refreshUnreadCount()
    },
    [refreshUnreadCount],
  )

  const markAllRead = useCallback(async () => {
    await notificationsApi.markRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }, [])

  const prependNotification = useCallback((raw: unknown) => {
    const n = normalizeNotification(raw)
    if (!n) return
    setNotifications((prev) => {
      if (prev.some((row) => row.id === n.id)) return prev
      return [n, ...prev]
    })
    if (!n.isRead) {
      setUnreadCount((c) => c + 1)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !userId) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    void refreshUnreadCount()
  }, [enabled, userId, refreshUnreadCount])

  useEffect(() => {
    if (!enabled || !userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('broadcast', { event: 'new_notification' }, ({ payload }) => {
        prependNotification(payload)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, userId, prependNotification])

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    loadNotifications,
    loadMoreNotifications,
    refreshUnreadCount,
    markRead,
    markAllRead,
  }
}
