import type { AdminReview } from '../../../../types/admin'

export function formatPersonName(first: string, last: string): string {
  return `${first} ${last}`.trim() || '—'
}

export function pickServiceName(review: AdminReview): string {
  const translations = review.givenService?.service?.translations ?? []
  const en = translations.find((t) => t.locale === 'EN' || t.locale === 'en')
  return (en ?? translations[0])?.name?.trim() || 'Service'
}

export function formatRatingNumber(value: number | string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

export function renderStars(rating: number): string {
  const r = Math.min(5, Math.max(0, Math.round(rating)))
  return `${'★'.repeat(r)}${'☆'.repeat(5 - r)}`
}

export function truncateComment(text: string | null, max = 60): string {
  if (!text?.trim()) return '—'
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}
