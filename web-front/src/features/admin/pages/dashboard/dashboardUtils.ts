import dayjs from 'dayjs'

export function formatPersonName(first: string, last: string): string {
  return `${first} ${last}`.trim() || '—'
}

export function pickServiceName(translations: { locale: string; name: string }[]): string {
  const en = translations.find((t) => t.locale === 'EN' || t.locale === 'en')
  return (en ?? translations[0])?.name?.trim() || 'Service'
}

export function formatScheduled(date: string, time: string): string {
  const d = dayjs(date)
  const datePart = d.isValid() ? d.format('D MMM YYYY') : date
  return `${datePart} · ${time}`
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
  return dayjs(iso).format('D MMM')
}

export function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}
