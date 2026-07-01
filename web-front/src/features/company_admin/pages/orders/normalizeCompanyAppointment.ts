import type { CompanyAppointment } from '../../../../types/company'

function toYmd(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return null
}

/** Map a realtime/API appointment payload into `CompanyAppointment`. */
export function normalizeCompanyAppointment(
  raw: unknown,
): CompanyAppointment | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string') return null

  return {
    id: r.id,
    status: r.status as CompanyAppointment['status'],
    scheduledDate: toYmd(r.scheduledDate) ?? '',
    scheduledTime: String(r.scheduledTime ?? ''),
    rescheduleDate: toYmd(r.rescheduleDate),
    rescheduleTime:
      r.rescheduleTime == null ? null : String(r.rescheduleTime),
    createdAt:
      typeof r.createdAt === 'string'
        ? r.createdAt
        : r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : '',
    confirmedAt:
      r.confirmedAt == null
        ? null
        : typeof r.confirmedAt === 'string'
          ? r.confirmedAt
          : r.confirmedAt instanceof Date
            ? r.confirmedAt.toISOString()
            : null,
    providerId: (r.providerId as string | null) ?? null,
    companyId: (r.companyId as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    latitude: (r.latitude as number | null) ?? null,
    longitude: (r.longitude as number | null) ?? null,
    refusalReason: (r.refusalReason as string | null) ?? null,
    client: (r.client as CompanyAppointment['client']) ?? null,
    provider: (r.provider as CompanyAppointment['provider']) ?? null,
    givenService: (r.givenService as CompanyAppointment['givenService']) ?? null,
    complaints: (r.complaints as CompanyAppointment['complaints']) ?? undefined,
    review: (r.review as CompanyAppointment['review']) ?? null,
  }
}
