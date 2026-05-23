import {
  AlertCircle,
  CheckCircle2,
  Flag,
  Search,
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
import type { GetAdminComplaintsParams } from '../../../../services/adminApi'
import type {
  AdminComplaint,
  ComplaintStats,
  ComplaintStatus,
} from '../../../../types/admin'
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CATEGORY_META,
  COMPLAINT_STATUSES,
  formatPersonName,
  getDecisionLabel,
} from './complaintMeta'
import './AdminComplaintsPage.css'

const PAGE_SIZE = 20

const DEFAULT_FILTERS: Record<string, string> = {
  status: '',
  category: '',
  sort: 'recent',
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function buildQueryParams(
  filters: Record<string, string>,
  page: number,
): GetAdminComplaintsParams {
  const params: GetAdminComplaintsParams = {
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  }
  if (filters.status) params.status = filters.status as ComplaintStatus
  if (filters.category) params.category = filters.category as AdminComplaint['category']
  if (filters.sort === 'oldest' || filters.sort === 'recent') {
    params.sort = filters.sort
  }
  return params
}

function rowClassForStatus(status: ComplaintStatus): string | undefined {
  if (status === 'OPEN') return 'admin-data-table__row--open'
  if (status === 'UNDER_REVIEW') return 'admin-data-table__row--review'
  return undefined
}

export function AdminComplaintsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [complaints, setComplaints] = useState<AdminComplaint[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ComplaintStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const openDetail = useCallback(
    (row: AdminComplaint) => {
      navigate(`/admin/reclamations/${row.id}`)
    },
    [navigate],
  )

  useEffect(() => {
    let cancelled = false
    void adminApi
      .getComplaintStats()
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
      .getAdminComplaints(buildQueryParams(filters, page))
      .then((res) => {
        if (cancelled) return
        setComplaints(res.data.items)
        setTotal(res.data.total)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiMessage(err))
        setComplaints([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filters, page])

  const openCount = stats?.open ?? 0

  const filterConfig = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'select' as const,
        options: [
          { value: '', label: 'All' },
          ...COMPLAINT_STATUSES.map((s) => ({
            value: s,
            label: s
              .split('_')
              .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
              .join(' '),
          })),
        ],
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select' as const,
        options: [
          { value: '', label: 'All' },
          ...COMPLAINT_CATEGORIES.map((c) => ({
            value: c,
            label: COMPLAINT_CATEGORY_META[c].label,
          })),
        ],
      },
      {
        key: 'sort',
        label: 'Sort',
        type: 'select' as const,
        options: [
          { value: 'recent', label: 'Most recent' },
          { value: 'oldest', label: 'Oldest' },
        ],
      },
    ],
    [],
  )

  const columns = useMemo<DataTableColumn<AdminComplaint>[]>(
    () => [
      {
        key: 'client',
        label: 'Client',
        width: '16%',
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
        width: '18%',
        render: (row) => (
          <UserMiniCard
            name={formatPersonName(
              row.provider.user.firstName,
              row.provider.user.lastName,
            )}
            city={row.provider.city}
            photo={row.provider.photoUrl}
            role={
              row.provider.type === 'EMPLOYEE' ? 'Employee' : 'Independent'
            }
            extraBadge={row.targetIsEmployee ? 'Employee' : undefined}
            badgeClassName={
              row.targetIsEmployee ? 'admin-user-mini__badge--purple' : undefined
            }
          />
        ),
      },
      {
        key: 'category',
        label: 'Category',
        width: '14%',
        render: (row) => {
          const meta = COMPLAINT_CATEGORY_META[row.category]
          const Icon = meta.Icon
          return (
            <span className="admin-complaints-page__category">
              <Icon size={16} aria-hidden />
              {meta.label}
            </span>
          )
        },
      },
      {
        key: 'status',
        label: 'Status',
        width: '11%',
        render: (row) => <StatusBadge type="complaint" status={row.status} />,
      },
      {
        key: 'filedAt',
        label: 'Filed at',
        width: '11%',
        render: (row) => {
          const d = dayjs(row.openedAt ?? row.createdAt)
          return d.isValid() ? d.format('D MMM YYYY') : '—'
        },
      },
      {
        key: 'decision',
        label: 'Decision',
        width: '12%',
        render: (row) =>
          row.decision ? (
            <span className="admin-complaints-page__decision-chip">
              {getDecisionLabel(row.decision)}
            </span>
          ) : (
            <span className="admin-complaints-page__pending">Pending</span>
          ),
      },
      {
        key: 'handler',
        label: 'Handler',
        width: '10%',
        render: (row) =>
          row.handledByAdmin ? (
            formatPersonName(
              row.handledByAdmin.user.firstName,
              row.handledByAdmin.user.lastName,
            )
          ) : (
            <span className="admin-complaints-page__unassigned">Unassigned</span>
          ),
      },
      {
        key: 'actions',
        label: '',
        width: '8%',
        render: (row) => (
          <button
            type="button"
            className={`admin-table-action${
              row.status === 'OPEN'
                ? ' admin-table-action--urgent'
                : row.status === 'UNDER_REVIEW'
                  ? ' admin-table-action--warn'
                  : ''
            }`}
            onClick={(e) => {
              e.stopPropagation()
              openDetail(row)
            }}
          >
            Review →
          </button>
        ),
      },
    ],
    [openDetail],
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="admin-complaints-page">
      <h1 className="admin-page-title">Reclamations</h1>

      <section className="admin-stats-grid" aria-label="Complaint statistics">
        <StatsCard
          title="Total complaints"
          value={stats?.total ?? '—'}
          icon={Flag}
          color="#6b7280"
        />
        <StatsCard
          title="Open (need action)"
          value={stats?.open ?? '—'}
          icon={AlertCircle}
          color="#dc2626"
        />
        <StatsCard
          title="Under review"
          value={stats?.underReview ?? '—'}
          icon={Search}
          color="#d97706"
        />
        <StatsCard
          title="Resolved this month"
          value={stats?.resolvedThisMonth ?? '—'}
          icon={CheckCircle2}
          color="#16a34a"
        />
      </section>

      {openCount > 0 ? (
        <div className="admin-complaints-page__alert" role="alert">
          <span>
            ⚠️ {openCount} complaint{openCount === 1 ? '' : 's'} require your
            attention
          </span>
          <button
            type="button"
            className="admin-complaints-page__alert-btn"
            onClick={() => {
              setFilters((f) => ({ ...f, status: 'OPEN' }))
              setPage(1)
            }}
          >
            Review now →
          </button>
        </div>
      ) : null}

      <FilterBar
        filters={filterConfig}
        values={filters}
        onChange={(key, value) => {
          setFilters((prev) => ({ ...prev, [key]: value }))
          setPage(1)
        }}
        onReset={() => {
          setFilters(DEFAULT_FILTERS)
          setPage(1)
        }}
      />

      {error ? (
        <p className="admin-complaints-page__error" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={complaints}
        loading={loading}
        onRowClick={openDetail}
        getRowClassName={(row) => rowClassForStatus(row.status)}
        emptyMessage="No complaints match your filters"
      />

      <div className="admin-pagination">
        <span>
          Showing {rangeStart}–{rangeEnd} of {total} complaints
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
