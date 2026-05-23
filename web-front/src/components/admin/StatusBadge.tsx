import './admin-components.css'

export type StatusBadgeType = 'appointment' | 'complaint' | 'review'

type StyleDef = { bg: string; text: string; border?: string }

const APPOINTMENT_STYLES: Record<string, StyleDef> = {
  PENDING: { bg: '#FEF3C7', text: '#92400E' },
  CONFIRMED: { bg: '#DBEAFE', text: '#1E40AF' },
  EN_ROUTE: { bg: '#EDE9FE', text: '#5B21B6' },
  IN_PROGRESS: { bg: '#E0E7FF', text: '#3730A3' },
  COMPLETED: { bg: '#DCFCE7', text: '#166534' },
  REFUSED: { bg: '#FEE2E2', text: '#991B1B' },
  CANCELLED_CLIENT: { bg: '#FEE2E2', text: '#991B1B' },
  CANCELLED_PROVIDER: { bg: '#FEE2E2', text: '#991B1B' },
  RESCHEDULED: { bg: '#FFEDD5', text: '#7C2D12' },
  DISPUTED: { bg: '#FEE2E2', text: '#991B1B', border: '#F87171' },
}

const COMPLAINT_STYLES: Record<string, StyleDef> = {
  OPEN: { bg: '#FEE2E2', text: '#991B1B' },
  UNDER_REVIEW: { bg: '#FEF3C7', text: '#92400E' },
  RESOLVED: { bg: '#DCFCE7', text: '#166534' },
  DISMISSED: { bg: '#F3F4F6', text: '#4B5563' },
  WITHDRAWN: { bg: '#F3F4F6', text: '#4B5563' },
}

const REVIEW_STYLES: Record<string, StyleDef> = {
  PUBLIC: { bg: '#DCFCE7', text: '#166534' },
  HIDDEN: { bg: '#FEE2E2', text: '#991B1B' },
}

function formatLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

export type StatusBadgeProps = {
  status: string
  type: StatusBadgeType
  size?: 'default' | 'large'
}

export function StatusBadge({ status, type, size = 'default' }: StatusBadgeProps) {
  const map =
    type === 'appointment'
      ? APPOINTMENT_STYLES
      : type === 'complaint'
        ? COMPLAINT_STYLES
        : REVIEW_STYLES

  const style = map[status] ?? { bg: '#F3F4F6', text: '#4B5563' }
  const isDisputed = type === 'appointment' && status === 'DISPUTED'
  const label = formatLabel(status)

  return (
    <span
      className={`admin-status-pill${isDisputed ? ' admin-status-pill--disputed' : ''}${size === 'large' ? ' admin-status-pill--large' : ''}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        ...(style.border ? { border: `1px solid ${style.border}` } : {}),
      }}
    >
      {isDisputed ? `⚠️ ${label}` : label}
    </span>
  )
}
