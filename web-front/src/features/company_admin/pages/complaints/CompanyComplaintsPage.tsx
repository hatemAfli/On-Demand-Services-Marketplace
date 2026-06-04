import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import {
  FaChevronLeft,
  FaChevronRight,
  FaFlag,
  FaMagnifyingGlass,
  FaTriangleExclamation,
} from 'react-icons/fa6'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyComplaintCategory,
  CompanyComplaintListItem,
  CompanyComplaintStats,
  CompanyComplaintStatus,
  ListCompanyComplaintsParams,
} from '../../../../types/company'
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  FORWARD_TARGET_LABELS,
  formatPersonName,
} from './complaintMeta'
import './CompanyComplaintsPage.css'

const PAGE_SIZE = 10

const STATUS_FILTERS: { value: '' | CompanyComplaintStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

const CATEGORY_FILTERS: { value: '' | CompanyComplaintCategory; label: string }[] = [
  { value: '', label: 'All categories' },
  ...(
    Object.entries(COMPLAINT_CATEGORY_LABELS) as [CompanyComplaintCategory, string][]
  ).map(([value, label]) => ({ value, label })),
]

const AVATAR_COLORS = [
  '#bfdbfe|#2563eb',
  '#e9d5ff|#9333ea',
  '#bbf7d0|#16a34a',
  '#fed7aa|#ea580c',
]

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
  }
  return fallback
}

function avatarColors(seed: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  const [bg, fg] = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length].split('|')
  return { bg, fg }
}

function statusBadgeClass(status: CompanyComplaintStatus): string {
  if (status === 'OPEN') return 'cp-badge cp-badge-open'
  if (status === 'UNDER_REVIEW') return 'cp-badge cp-badge-review'
  if (status === 'RESOLVED') return 'cp-badge cp-badge-resolved'
  return 'cp-badge cp-badge-dismissed'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function CompanyComplaintsPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<CompanyComplaintStats | null>(null)
  const [items, setItems] = useState<CompanyComplaintListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | CompanyComplaintStatus>('')
  const [categoryFilter, setCategoryFilter] = useState<'' | CompanyComplaintCategory>('')

  const queryParams = useMemo((): ListCompanyComplaintsParams => {
    const params: ListCompanyComplaintsParams = {
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      sort: 'recent',
    }
    if (statusFilter) params.status = statusFilter
    if (categoryFilter) params.category = categoryFilter
    return params
  }, [page, statusFilter, categoryFilter])

  useEffect(() => {
    let cancelled = false
    void companyApi
      .getCompanyComplaintStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        if (!cancelled) setStats(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadList = useCallback(() => {
    setLoading(true)
    setError(null)
    void companyApi
      .getCompanyComplaints(queryParams)
      .then((res) => {
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        setError(errorMessage(err, 'Could not load complaints'))
        setItems([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [queryParams])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="cp-root">
      <h1 className="cp-page-title">Complaints</h1>
      <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
        Customer complaints forwarded to your company about your employees.
      </p>

      <section className="cp-kpi-grid" aria-label="Complaint statistics">
        <div className="cp-kpi-card">
          <p>Total</p>
          <h3>{stats?.total ?? '—'}</h3>
        </div>
        <div className="cp-kpi-card">
          <p>Open</p>
          <h3 style={{ color: '#dc2626' }}>{stats?.open ?? '—'}</h3>
        </div>
        <div className="cp-kpi-card">
          <p>Under review</p>
          <h3 style={{ color: '#ea580c' }}>{stats?.underReview ?? '—'}</h3>
        </div>
        <div className="cp-kpi-card">
          <p>Resolved this month</p>
          <h3 style={{ color: '#059669' }}>{stats?.resolvedThisMonth ?? '—'}</h3>
        </div>
      </section>

      <div className="cp-toolbar">
        <FaMagnifyingGlass style={{ color: '#94a3b8' }} aria-hidden />
        <select
          className="cp-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as '' | CompanyComplaintStatus)
          }
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value || 'all'} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="cp-select"
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as '' | CompanyComplaintCategory)
          }
        >
          {CATEGORY_FILTERS.map((f) => (
            <option key={f.value || 'all'} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <div className="cp-error">{error}</div> : null}

      <div className="cp-table-wrap">
        <table className="cp-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Provider</th>
              <th>Service</th>
              <th>Category</th>
              <th>Routing</th>
              <th>Status</th>
              <th>Filed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="cp-empty">
                  Loading complaints…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="cp-empty">
                  <FaFlag style={{ marginBottom: 8, opacity: 0.4 }} />
                  <div>No complaints match your filters.</div>
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const clientColors = avatarColors(
                  row.client.user.email ?? row.id,
                )
                const providerColors = avatarColors(row.provider.user.firstName)
                return (
                  <tr
                    key={row.id}
                    className={row.status === 'OPEN' ? 'cp-row-open' : undefined}
                    onClick={() => navigate(`/company/complaints/${row.id}`)}
                  >
                    <td>
                      <div className="cp-person">
                        <div
                          className="cp-avatar"
                          style={{
                            background: clientColors.bg,
                            color: clientColors.fg,
                          }}
                        >
                          {formatPersonName(
                            row.client.user.firstName,
                            row.client.user.lastName,
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="cp-person-name">
                            {formatPersonName(
                              row.client.user.firstName,
                              row.client.user.lastName,
                            )}
                          </div>
                          <div className="cp-person-sub">
                            {row.client.user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="cp-person">
                        <div
                          className="cp-avatar"
                          style={{
                            background: providerColors.bg,
                            color: providerColors.fg,
                          }}
                        >
                          {formatPersonName(
                            row.provider.user.firstName,
                            row.provider.user.lastName,
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="cp-person-name">
                          {formatPersonName(
                            row.provider.user.firstName,
                            row.provider.user.lastName,
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{row.appointment.serviceName}</td>
                    <td>{COMPLAINT_CATEGORY_LABELS[row.category]}</td>
                    <td>
                      <span className="cp-badge cp-badge-forward">
                        {FORWARD_TARGET_LABELS[row.forwardTarget]}
                      </span>
                    </td>
                    <td>
                      <span className={statusBadgeClass(row.status)}>
                        {COMPLAINT_STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td>{formatDate(row.openedAt ?? row.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="cp-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/company/complaints/${row.id}`)
                        }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <div className="cp-pagination">
          <span>
            {total === 0
              ? 'No results'
              : `${rangeStart}–${rangeEnd} of ${total}`}
          </span>
          <div className="cp-pagination-btns">
            <button
              type="button"
              className="cp-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <FaChevronLeft />
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="cp-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      {stats && stats.open > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: '#fff7ed',
            borderRadius: 12,
            border: '1px solid #fed7aa',
            fontSize: 14,
            color: '#9a3412',
          }}
        >
          <FaTriangleExclamation />
          <span>
            {stats.open} complaint{stats.open === 1 ? '' : 's'} need your attention.
          </span>
        </div>
      ) : null}
    </div>
  )
}
