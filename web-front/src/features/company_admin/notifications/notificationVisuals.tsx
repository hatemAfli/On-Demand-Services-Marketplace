import type { IconType } from 'react-icons'
import {
  FaBriefcase,
  FaCalendarCheck,
  FaCircleExclamation,
  FaClipboardList,
  FaShieldHalved,
  FaStar,
  FaUserCheck,
} from 'react-icons/fa6'
import type { NotificationType } from '../../../types/notification'

export type NotificationVisual = {
  icon: IconType
  bg: string
  color: string
}

export function getNotificationVisual(type: NotificationType): NotificationVisual {
  switch (type) {
    case 'COMPANY_NEW_REQUEST':
    case 'APPOINTMENT_NEW_REQUEST':
      return { icon: FaClipboardList, bg: '#eff6ff', color: '#2563eb' }
    case 'COMPANY_BOOKING_CANCELLED':
    case 'APPOINTMENT_CANCELLED_CLIENT':
    case 'APPOINTMENT_CANCELLED_PROVIDER':
    case 'APPOINTMENT_REFUSED':
      return { icon: FaCircleExclamation, bg: '#fef2f2', color: '#dc2626' }
    case 'EMPLOYEE_INVITATION_ACCEPTED':
    case 'EMPLOYEE_INVITATION_DECLINED':
    case 'EMPLOYEE_INVITATION_RECEIVED':
    case 'EMPLOYEE_INVITATION_CANCELLED':
    case 'EMPLOYEE_REMOVED_FROM_COMPANY':
      return { icon: FaBriefcase, bg: '#ede9fe', color: '#7c3aed' }
    case 'COMPLAINT_FILED':
    case 'COMPLAINT_STATUS_UPDATED':
    case 'COMPLAINT_RESOLVED':
    case 'COMPLAINT_DISMISSED':
    case 'SYSTEM_ANNOUNCEMENT':
      return { icon: FaShieldHalved, bg: '#fff7ed', color: '#ea580c' }
    case 'NEW_REVIEW':
      return { icon: FaStar, bg: '#fef9c3', color: '#ca8a04' }
    case 'ACCOUNT_VERIFIED':
    case 'DOCUMENT_ACCEPTED':
      return { icon: FaUserCheck, bg: '#ecfdf5', color: '#059669' }
    case 'APPOINTMENT_CONFIRMED':
    case 'APPOINTMENT_COMPLETED':
      return { icon: FaCalendarCheck, bg: '#ecfdf5', color: '#059669' }
    default:
      return { icon: FaClipboardList, bg: '#f1f5f9', color: '#64748b' }
  }
}

export function formatNotificationTime(createdAt: string): string {
  const ts = new Date(createdAt).getTime()
  if (Number.isNaN(ts)) return ''
  const diffMin = Math.floor((Date.now() - ts) / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const d = new Date(ts)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}
