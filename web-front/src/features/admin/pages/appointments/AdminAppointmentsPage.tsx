import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Timer,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DataTable,
  FilterBar,
  StatsCard,
  StatusBadge,
  UserMiniCard,
} from '../../../../components/admin'
import type { DataTableColumn } from '../../../../components/admin'
import { adminApi } from '../../../../services/adminApi'
import type { GetAdminAppointmentsParams } from '../../../../services/adminApi'
import type {
  AdminAppointment,
  AppointmentStats,
  AppointmentStatus,
} from '../../../../types/admin'
import './AdminAppointmentsPage.css'

const PAGE_SIZE = 20

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'REFUSED',
  'RESCHEDULED',
  'CANCELLED_CLIENT',
  'CANCELLED_PROVIDER',
  'EN_ROUTE',
  'IN_PROGRESS',
  'COMPLETED',
  'DISPUTED',
]

const DEFAULT_FILTERS: Record<string, string> = {
  status: '',
  from: '',
  to: '',
  hasDispute: '',
  sort: 'recent',
}

function formatPersonName(first: string, last: string): string {
  return `${first} ${last}`.trim() || '—'
}

function pickServiceName(row: AdminAppointment): string {
  const translations = row.givenService?.service?.translations ?? []
  const en = translations.find((t) => t.locale === 'EN' || t.locale === 'en')
  const name = (en ?? translations[0])?.name?.trim()
  return name || 'Service'
}

function formatScheduled(date: string, time: string): string {
  const d = dayjs(date)
  const datePart = d.isValid() ? d.format('ddd D MMM') : date
  return `${datePart} · ${time}`
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function buildQueryParams(
  filters: Record<string, string>,
  page: number,
): GetAdminAppointmentsParams {
  const params: GetAdminAppointmentsParams = {
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  }

  if (filters.status) {
    params.status = filters.status as AppointmentStatus
  }
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.hasDispute === 'disputed') params.hasDispute = true

  const sort = filters.sort
  if (
    sort === 'recent' ||
    sort === 'oldest' ||
    sort === 'scheduled_asc' ||
    sort === 'scheduled_desc'
  ) {
    params.sort = sort
  }

  return params
}

export function AdminAppointmentsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AppointmentStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openDetail = useCallback(
    (row: AdminAppointment) => {
      navigate(`/admin/appointments/${row.id}`)
    },
    [navigate],
  )

  useEffect(() => {
    let cancelled = false
    void adminApi
      .getAppointmentStats()
      .then((res) => {
        if (!cancelled) setStats(res.data)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void adminApi
      .getAdminAppointments(buildQueryParams(filters, page))
      .then((res) => {
        if (cancelled) return
        setAppointments(res.data.items)
        setTotal(res.data.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiMessage(err))
        setAppointments([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters, page])

  const filterConfig = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select' as const,
        options: [
          { value: '', label: 'All' },
          ...APPOINTMENT_STATUSES.map((s) => ({
            value: s,
            label: s
              .split('_')
              .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
              .join(' '),
          })),
        ],
      },
      { key: 'from', label: 'From date', type: 'date' as const },
      { key: 'to', label: 'To date', type: 'date' as const },
      {
        key: 'hasDispute',
        label: 'Dispute',
        type: 'select' as const,
        options: [
          { value: '', label: 'All' },
          { value: 'disputed', label: 'Disputed only' },
        ],
      },
      {
        key: 'sort',
        label: 'Sort',
        type: 'select' as const,
        options: [
          { value: 'recent', label: 'Most recent' },
          { value: 'oldest', label: 'Oldest' },
          { value: 'scheduled_asc', label: 'Scheduled ↑' },
          { value: 'scheduled_desc', label: 'Scheduled ↓' },
        ],
      },
    ],
    [],
  )

  const columns = useMemo<DataTableColumn<AdminAppointment>[]>(
    () => [
      {
        key: 'client',
        label: 'Client',
        width: '18%',
        render: (row) => (
          <UserMiniCard
            name={formatPersonName(
              row.client.user.firstName,
              row.client.user.lastName,
            )}
            email={row.client.user.email}
            photo={row.client.imageUrl}
          />
        ),
      },
      {
        key: 'provider',
        label: 'Provider',
        width: '16%',
        render: (row) => (
          <UserMiniCard
            name={formatPersonName(
              row.provider.user.firstName,
              row.provider.user.lastName,
            )}
            city={row.provider.city}
            photo={row.provider.photoUrl}
          />
        ),
      },
      {
        key: 'service',
        label: 'Service',
        width: '14%',
        render: (row) => pickServiceName(row),
      },
      {
        key: 'scheduled',
        label: 'Scheduled',
        width: '14%',
        render: (row) =>
          formatScheduled(row.scheduledDate, row.scheduledTime),
      },
      {
        key: 'status',
        label: 'Status',
        width: '12%',
        render: (row) => (
          <StatusBadge type="appointment" status={row.status} />
        ),
      },
      {
        key: 'complaints',
        label: 'Complaints',
        width: '8%',
        render: (row) =>
          row.complaints.length > 0 ? (
            <span className="admin-count-badge">{row.complaints.length}</span>
          ) : (
            <span className="admin-muted">—</span>
          ),
      },
      {
        key: 'review',
        label: 'Review',
        width: '8%',
        render: (row) =>
          row.review ? (
            <span className="admin-rating-pill">⭐ {row.review.rating}</span>
          ) : (
            <span className="admin-muted">—</span>
          ),
      },
      {
        key: 'actions',
        label: '',
        width: '8%',
        render: (row) => (
          <button
            type="button"
            className="admin-table-action"
            onClick={(e) => {
              e.stopPropagation()
              openDetail(row)
            }}
          >
            View →
          </button>
        ),
      },
    ],
    [openDetail],
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  return (
    <div className="admin-appointments-page">
      <h1 className="admin-page-title">Appointments</h1>

      <section className="admin-stats-grid" aria-label="Appointment statistics">
        <StatsCard
          title="Total appointments"
          value={stats?.total ?? '—'}
          icon={CalendarClock}
          color="#2563eb"
        />
        <StatsCard
          title="Completed today"
          value={stats?.completedToday ?? '—'}
          icon={CheckCircle2}
          color="#16a34a"
        />
        <StatsCard
          title="Active disputes"
          value={stats?.disputedActive ?? '—'}
          icon={AlertTriangle}
          color="#dc2626"
        />
        <StatsCard
          title="Avg duration (min)"
          value={
            stats != null ? stats.averageDurationMinutes : '—'
          }
          icon={Timer}
          color="#4f46e5"
        />
      </section>

      <FilterBar
        filters={filterConfig}
        values={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {error ? (
        <p className="admin-appointments-page__error" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={appointments}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No appointments match your filters"
      />

      <div className="admin-pagination">
        <span>
          Showing {rangeStart}–{rangeEnd} of {total} appointments
        </span>
        <div className="admin-pagination__actions">
          <button
            type="button"
            className="admin-pagination__btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="admin-pagination__btn"
            disabled={page >= totalPages || loading || total === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
