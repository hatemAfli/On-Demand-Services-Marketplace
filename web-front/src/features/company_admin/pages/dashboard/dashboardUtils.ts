import type {
  CompanyAppointmentStatus,
} from '../../../../types/company'

export const STATUS_UI: Record<
  CompanyAppointmentStatus,
  { label: string; tone: string }
> = {
  PENDING: { label: 'Pending', tone: 'yellow' },
  CONFIRMED: { label: 'Confirmed', tone: 'blue' },
  RESCHEDULED: { label: 'Rescheduled', tone: 'yellow' },
  EN_ROUTE: { label: 'En route', tone: 'blue' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  REFUSED: { label: 'Refused', tone: 'gray' },
  CANCELLED_CLIENT: { label: 'Cancelled', tone: 'gray' },
  CANCELLED_PROVIDER: { label: 'Cancelled', tone: 'gray' },
  DISPUTED: { label: 'Dispute', tone: 'red' },
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value))
}

export function formatTrend(pct: number | null): string | null {
  if (pct == null) return null
  if (pct === 0) return 'Same as yesterday'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}% vs yesterday`
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function providerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function avatarColor(seed: string): { bg: string; fg: string } {
  const palette = [
    '#bfdbfe|#2563eb',
    '#e9d5ff|#9333ea',
    '#bbf7d0|#16a34a',
    '#fed7aa|#ea580c',
    '#fbcfe8|#db2777',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  const [bg, fg] = palette[Math.abs(hash) % palette.length].split('|')
  return { bg, fg }
}
