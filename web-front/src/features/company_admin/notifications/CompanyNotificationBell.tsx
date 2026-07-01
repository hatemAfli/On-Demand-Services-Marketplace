import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBell, FaCheckDouble, FaInbox } from 'react-icons/fa6'
import { useCompanyNotifications } from '../../../hooks/useCompanyNotifications'
import type { AppNotification } from '../../../types/notification'
import { resolveCompanyNotificationTarget } from './companyNotificationNavigation'
import {
  formatNotificationTime,
  getNotificationVisual,
} from './notificationVisuals'
import './CompanyNotificationBell.css'

type Props = {
  brandColor?: string
}

export function CompanyNotificationBell({ brandColor = '#7621C2' }: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const listRef = useRef<HTMLDivElement>(null)

  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    loadNotifications,
    loadMoreNotifications,
    markRead,
    markAllRead,
  } = useCompanyNotifications(true)

  useEffect(() => {
    if (open) void loadNotifications()
  }, [open, loadNotifications])

  useEffect(() => {
    if (!open || loading || loadingMore || !hasMore) return
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 8) {
      void loadMoreNotifications()
    }
  }, [
    open,
    loading,
    loadingMore,
    hasMore,
    notifications.length,
    loadMoreNotifications,
  ])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handlePress = useCallback(
    async (item: AppNotification) => {
      if (!item.isRead) {
        await markRead([item.id])
      }
      const target = resolveCompanyNotificationTarget(item)
      setOpen(false)
      if (target) {
        navigate(target.path)
      }
    },
    [markRead, navigate],
  )

  const hasUnread = unreadCount > 0

  return (
    <div className="cnb-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`company-notification-btn${open ? ' active' : ''}`}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        style={
          open
            ? {
                borderColor: `color-mix(in srgb, ${brandColor} 35%, #e5e7eb)`,
                color: brandColor,
              }
            : undefined
        }
      >
        <FaBell />
        {hasUnread ? (
          <span className="cnb-count" aria-label={`${unreadCount} unread`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="cnb-panel"
          role="dialog"
          aria-label="Notifications"
          style={
            {
              '--cnb-brand': brandColor,
            } as CSSProperties
          }
        >
          <div className="cnb-panel-head">
            <div>
              <h2 className="cnb-panel-title">Notifications</h2>
              <p className="cnb-panel-sub">
                {hasUnread
                  ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
                  : 'You are all caught up'}
              </p>
            </div>
            {notifications.some((n) => !n.isRead) ? (
              <button
                type="button"
                className="cnb-mark-all"
                onClick={() => void markAllRead()}
              >
                <FaCheckDouble />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="cnb-list" role="list" ref={listRef}>
            {loading ? (
              <div className="cnb-loading">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="cnb-skeleton" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="cnb-empty">
                <div className="cnb-empty-icon">
                  <FaInbox />
                </div>
                <p className="cnb-empty-title">No notifications yet</p>
                <p className="cnb-empty-sub">
                  New orders, team updates, and complaints will appear here.
                </p>
              </div>
            ) : (
              <>
                {notifications.map((item) => {
                  const visual = getNotificationVisual(item.type)
                  const Icon = visual.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="listitem"
                      className={`cnb-item${item.isRead ? '' : ' unread'}`}
                      onClick={() => void handlePress(item)}
                    >
                      <span
                        className="cnb-item-icon"
                        style={{ background: visual.bg, color: visual.color }}
                        aria-hidden
                      >
                        <Icon />
                      </span>
                      <span className="cnb-item-body">
                        <span className="cnb-item-title">{item.title}</span>
                        <span className="cnb-item-text">{item.body}</span>
                        <span className="cnb-item-time">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </span>
                      {!item.isRead ? (
                        <span className="cnb-item-dot" aria-hidden />
                      ) : null}
                    </button>
                  )
                })}
                {loadingMore ? (
                  <div className="cnb-footer-loader" aria-live="polite">
                    <span className="cnb-footer-spinner" aria-hidden />
                    <span>Loading more…</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
