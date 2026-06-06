import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './CompanyOrdersPage.css'
import {
  FaChevronLeft,
  FaChevronRight,
  FaClipboardList,
  FaGears,
  FaGaugeHigh,
  FaLocationDot,
  FaMagnifyingGlass,
  FaRotate,
  FaStopwatch,
  FaUserPlus,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegCalendar, FaRegClock, FaCheck, FaStar } from 'react-icons/fa'
import { useAppointmentRealtime } from '../../../../hooks/useAppointmentRealtime'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyAppointment,
  CompanyAppointmentStats,
  CompanyAppointmentStatus,
  CompanyAvailableProvider,
} from '../../../../types/company'
import { normalizeCompanyAppointment } from './normalizeCompanyAppointment'

const PAGE_SIZE = 10

type StatusFilter = '' | CompanyAppointmentStatus
type AssignmentFilter = '' | 'ASSIGNED' | 'UNASSIGNED'

const STATUS_CONFIG: Record<
  CompanyAppointmentStatus,
  { label: string; cls: string }
> = {
  PENDING: { label: 'Pending', cls: 'co-status-pending' },
  CONFIRMED: { label: 'Confirmed', cls: 'co-status-active' },
  RESCHEDULED: { label: 'Rescheduled', cls: 'co-status-pending' },
  EN_ROUTE: { label: 'En route', cls: 'co-status-active' },
  IN_PROGRESS: { label: 'In progress', cls: 'co-status-active' },
  COMPLETED: { label: 'Completed', cls: 'co-status-completed' },
  REFUSED: { label: 'Refused', cls: 'co-status-cancelled' },
  CANCELLED_CLIENT: { label: 'Cancelled (client)', cls: 'co-status-cancelled' },
  CANCELLED_PROVIDER: { label: 'Cancelled (provider)', cls: 'co-status-cancelled' },
  DISPUTED: { label: 'Disputed', cls: 'co-status-dispute' },
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REFUSED', label: 'Refused' },
  { value: 'CANCELLED_CLIENT', label: 'Cancelled (client)' },
  { value: 'DISPUTED', label: 'Disputed' },
]

const AVATAR_COLORS = [
  '#bfdbfe|#2563eb',
  '#e9d5ff|#9333ea',
  '#bbf7d0|#16a34a',
  '#fed7aa|#ea580c',
  '#fbcfe8|#db2777',
  '#a5f3fc|#0891b2',
]

const TERMINAL_STATUSES: CompanyAppointmentStatus[] = [
  'COMPLETED',
  'CANCELLED_CLIENT',
  'CANCELLED_PROVIDER',
  'REFUSED',
]

function clientName(appt: CompanyAppointment): string {
  const u = appt.client?.user
  if (!u) return 'Unknown client'
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Unknown client'
}

function providerName(appt: CompanyAppointment): string | null {
  const u = appt.provider?.user
  if (!u) return null
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function serviceName(appt: CompanyAppointment): string {
  const t = appt.givenService?.service?.translations
  return t?.[0]?.name ?? 'Service'
}

function categoryName(appt: CompanyAppointment): string {
  const t = appt.givenService?.service?.category?.translations
  return t?.[0]?.name ?? ''
}

function priceOf(appt: CompanyAppointment): number {
  const p = appt.givenService?.price
  return p == null ? 0 : Number(p)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function effectiveSlot(appt: CompanyAppointment): {
  date: string
  time: string
  isProposed: boolean
} {
  if (
    appt.status === 'RESCHEDULED' &&
    appt.rescheduleDate &&
    appt.rescheduleTime
  ) {
    return {
      date: appt.rescheduleDate,
      time: appt.rescheduleTime,
      isProposed: true,
    }
  }
  return {
    date: appt.scheduledDate,
    time: appt.scheduledTime,
    isProposed: false,
  }
}

function canAssignProvider(appt: CompanyAppointment): boolean {
  return appt.status === 'PENDING' && !TERMINAL_STATUSES.includes(appt.status)
}

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function clampDateYmd(dateStr: string, minYmd: string): string {
  const key = dateStr.slice(0, 10)
  return key >= minYmd ? key : minYmd
}

function rescheduleLoadError(err: unknown): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const res = (
      err as { response?: { data?: { message?: string | string[] }; status?: number } }
    ).response
    const msg = res?.data?.message
    if (Array.isArray(msg)) return msg.join(', ')
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return 'Could not load available times. Please try again.'
}

export function CompanyOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<CompanyAppointment[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<CompanyAppointmentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('')
  const [page, setPage] = useState(0)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CompanyAppointment | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Inline action state inside the drawer
  const [actionMode, setActionMode] = useState<'refuse' | 'reschedule' | null>(null)
  const [refusalReason, setRefusalReason] = useState('')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([])
  const [rescheduleOptionsLoading, setRescheduleOptionsLoading] = useState(false)
  const [rescheduleOptionsError, setRescheduleOptionsError] = useState<
    string | null
  >(null)
  const [submitting, setSubmitting] = useState(false)

  const rescheduleMinDate = useMemo(() => todayYmdLocal(), [])

  // Assign provider modal
  const [assignOpen, setAssignOpen] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<
    CompanyAvailableProvider[]
  >([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [confirmOnAssign, setConfirmOnAssign] = useState(true)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const loadRescheduleSlots = useCallback(
    async (appointmentId: string, date: string, preferredTime?: string) => {
      setRescheduleOptionsLoading(true)
      setRescheduleOptionsError(null)
      setRescheduleSlots([])
      try {
        const res = await companyApi.getCompanyAppointmentRescheduleOptions(
          appointmentId,
          { date },
        )
        const slots = res.options[0]?.slots ?? []
        setRescheduleSlots(slots)
        if (slots.length > 0) {
          setRescheduleTime(
            preferredTime && slots.includes(preferredTime)
              ? preferredTime
              : slots[0],
          )
        } else {
          setRescheduleTime('')
        }
      } catch (err) {
        setRescheduleOptionsError(rescheduleLoadError(err))
        setRescheduleTime('')
      } finally {
        setRescheduleOptionsLoading(false)
      }
    },
    [],
  )

  const loadStats = useCallback(async () => {
    try {
      const s = await companyApi.getCompanyAppointmentStats()
      setStats(s)
    } catch {
      /* non-blocking */
    }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await companyApi.getCompanyAppointments({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(assignmentFilter ? { assignment: assignmentFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      setError('Could not load orders. Please try again.')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, assignmentFilter, search, page])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void loadList()
  }, [loadList])

  // Debounce the search input.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0)
      setSearch(searchInput)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (actionMode !== 'reschedule' || !selectedId || !detail) return

    const preferred = effectiveSlot(detail)
    const initialDate = clampDateYmd(preferred.date, rescheduleMinDate)
    setRescheduleDate(initialDate)
    void loadRescheduleSlots(selectedId, initialDate, preferred.time)
  }, [actionMode, selectedId, detail, rescheduleMinDate, loadRescheduleSlots])

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id)
    setActionMode(null)
    setRefusalReason('')
    setRescheduleDate('')
    setRescheduleTime('')
    setDetailLoading(true)
    try {
      const d = await companyApi.getCompanyAppointmentById(id)
      setDetail(d)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDrawer = useCallback(() => {
    setSelectedId(null)
    setDetail(null)
    setActionMode(null)
  }, [])

  useEffect(() => {
    const orderId = searchParams.get('order')
    if (!orderId) return
    void openDetail(orderId)
    const next = new URLSearchParams(searchParams)
    next.delete('order')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, openDetail])

  const syncFromRealtime = useCallback(
    async (raw: unknown) => {
      const parsed = normalizeCompanyAppointment(raw)
      if (!parsed?.id) {
        if (selectedId) {
          try {
            const d = await companyApi.getCompanyAppointmentById(selectedId)
            setDetail(d)
          } catch {
            /* ignore */
          }
        }
        void loadList()
        void loadStats()
        return
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === parsed.id
            ? {
                ...row,
                status: parsed.status,
                scheduledDate: parsed.scheduledDate,
                scheduledTime: parsed.scheduledTime,
                rescheduleDate: parsed.rescheduleDate,
                rescheduleTime: parsed.rescheduleTime,
                providerId: parsed.providerId,
              }
            : row,
        ),
      )

      if (selectedId === parsed.id) {
        setDetail(parsed)
        if (
          parsed.status !== 'PENDING' &&
          parsed.status !== 'RESCHEDULED'
        ) {
          setActionMode(null)
        }
        if (parsed.status !== 'PENDING') {
          setAssignOpen(false)
        }
      }

      void loadStats()
    },
    [selectedId, loadList, loadStats],
  )

  useAppointmentRealtime(selectedId, syncFromRealtime)

  const refreshAfterAction = useCallback(
    async (id: string) => {
      await Promise.all([loadList(), loadStats()])
      try {
        const d = await companyApi.getCompanyAppointmentById(id)
        setDetail(d)
      } catch {
        /* ignore */
      }
    },
    [loadList, loadStats],
  )

  const openAssign = useCallback(async (id: string) => {
    setAssignOpen(true)
    setProvidersLoading(true)
    setAvailableProviders([])
    try {
      const list = await companyApi.getCompanyAppointmentAvailableProviders(id)
      setAvailableProviders(list)
    } catch {
      setAvailableProviders([])
    } finally {
      setProvidersLoading(false)
    }
  }, [])

  const handleConfirm = useCallback(
    async (appt: CompanyAppointment) => {
      if (!appt.providerId) {
        await openAssign(appt.id)
        return
      }
      setSubmitting(true)
      try {
        await companyApi.respondCompanyAppointment(appt.id, { action: 'CONFIRMED' })
        await refreshAfterAction(appt.id)
      } catch {
        /* ignore */
      } finally {
        setSubmitting(false)
      }
    },
    [openAssign, refreshAfterAction],
  )

  const handleRefuse = useCallback(
    async (appt: CompanyAppointment) => {
      setSubmitting(true)
      try {
        await companyApi.respondCompanyAppointment(appt.id, {
          action: 'REFUSED',
          refusalReason: refusalReason.trim() || undefined,
        })
        setActionMode(null)
        await refreshAfterAction(appt.id)
      } catch {
        /* ignore */
      } finally {
        setSubmitting(false)
      }
    },
    [refusalReason, refreshAfterAction],
  )

  const handleReschedule = useCallback(
    async (appt: CompanyAppointment) => {
      if (!rescheduleDate || !rescheduleTime) return
      setSubmitting(true)
      try {
        await companyApi.respondCompanyAppointment(appt.id, {
          action: 'RESCHEDULED',
          rescheduleDate,
          rescheduleTime,
        })
        setActionMode(null)
        setRescheduleDate('')
        setRescheduleTime('')
        setRescheduleSlots([])
        await refreshAfterAction(appt.id)
      } catch {
        /* ignore */
      } finally {
        setSubmitting(false)
      }
    },
    [rescheduleDate, rescheduleTime, refreshAfterAction],
  )

  const handleAssign = useCallback(
    async (providerId: string) => {
      if (!selectedId) return
      setSubmitting(true)
      try {
        await companyApi.assignCompanyAppointmentProvider(selectedId, {
          providerId,
          confirm: confirmOnAssign,
        })
        setAssignOpen(false)
        await refreshAfterAction(selectedId)
      } catch {
        /* ignore */
      } finally {
        setSubmitting(false)
      }
    },
    [selectedId, confirmOnAssign, refreshAfterAction],
  )

  const rangeFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeTo = Math.min(total, (page + 1) * PAGE_SIZE)
  const cancellationRateText =
    stats?.cancellationRate !== undefined
      ? `${stats.cancellationRate.toFixed(2)}%`
      : '—'
  const avgResponseText =
    stats?.averageResponseTime !== null && stats?.averageResponseTime !== undefined
      ? `${stats.averageResponseTime.toFixed(1)} min`
      : '—'

  const pageButtons = useMemo(() => {
    const pages: number[] = []
    const maxButtons = 5
    let start = Math.max(0, page - 2)
    const end = Math.min(totalPages - 1, start + maxButtons - 1)
    start = Math.max(0, end - maxButtons + 1)
    for (let i = start; i <= end; i += 1) pages.push(i)
    return pages
  }, [page, totalPages])

  return (
    <div className="co-root">
      {/* Stats */}
      <div className="co-stats-grid">
        <article className="co-stat-card co-hover-purple">
          <div>
            <p>Today's Orders</p>
            <h3>{stats?.todaysOrders ?? '—'}</h3>
            <span className="co-trend-blue">All company bookings</span>
          </div>
          <div className="co-stat-icon purple"><FaClipboardList /></div>
        </article>

        <article className="co-stat-card co-hover-yellow">
          <div>
            <p>Pending Assignment</p>
            <h3>{stats?.pendingAssignment ?? '—'}</h3>
            <span className="co-trend-yellow">Requires attention</span>
          </div>
          <div className="co-stat-icon yellow"><FaRegClock /></div>
        </article>

        <article className="co-stat-card co-hover-blue">
          <div>
            <p>In Progress</p>
            <h3>{stats?.inProgress ?? '—'}</h3>
            <span className="co-trend-blue"><FaRotate /> Active now</span>
          </div>
          <div className="co-stat-icon blue"><FaGears /></div>
        </article>

        <article className="co-stat-card co-hover-green">
          <div>
            <p>Total Orders</p>
            <h3>{stats?.total ?? '—'}</h3>
            <span className="co-trend-green">All time</span>
          </div>
          <div className="co-stat-icon green"><FaCheck /></div>
        </article>

        <article className="co-stat-card co-hover-red">
          <div>
            <p>Cancellation Rate</p>
            <h3>{cancellationRateText}</h3>
            <span className="co-trend-red">Refused company requests</span>
          </div>
          <div className="co-stat-icon red"><FaGaugeHigh /></div>
        </article>

        <article className="co-stat-card co-hover-indigo">
          <div>
            <p>Average Response Time</p>
            <h3>{avgResponseText}</h3>
            <span className="co-trend-indigo">Company admin response speed</span>
          </div>
          <div className="co-stat-icon indigo"><FaStopwatch /></div>
        </article>
      </div>

      {/* Table card */}
      <div className="co-table-card">
        {/* Filters */}
        <div className="co-filters">
          <div className="co-filters-left">
            <div className="co-search-wrap">
              <FaMagnifyingGlass className="co-search-icon" />
              <input
                type="text"
                placeholder="Search by customer name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="co-selects">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setPage(0)
                  setStatusFilter(e.target.value as StatusFilter)
                }}
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={assignmentFilter}
                onChange={(e) => {
                  setPage(0)
                  setAssignmentFilter(e.target.value as AssignmentFilter)
                }}
              >
                <option value="">All Assignments</option>
                <option value="UNASSIGNED">Unassigned</option>
                <option value="ASSIGNED">Assigned</option>
              </select>
            </div>
          </div>
          <div className="co-filters-right">
            <button title="Refresh" onClick={() => { void loadList(); void loadStats() }}>
              <FaRotate />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="co-table-scroll">
          <table className="co-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date &amp; Time</th>
                <th>Customer</th>
                <th>Service</th>
                <th>Provider</th>
                <th>Status</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="co-empty-cell">Loading orders…</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="co-empty-cell co-empty-error">{error}</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="co-empty-cell">No orders found.</td>
                </tr>
              ) : (
                items.map((order) => {
                  const { label, cls } = STATUS_CONFIG[order.status]
                  const cName = clientName(order)
                  const [bgColor, textColor] = colorFor(cName).split('|')
                  const pName = providerName(order)
                  const highlight = order.status === 'PENDING' && !order.providerId
                  return (
                    <tr
                      key={order.id}
                      className={`co-tr${highlight ? ' hl-red' : ''}`}
                      onClick={() => openDetail(order.id)}
                    >
                      <td className="co-td-id">#{order.id.slice(0, 8)}</td>

                      <td className="co-td-date">
                        <div>{formatDate(order.scheduledDate)}</div>
                        <small>{order.scheduledTime}</small>
                      </td>

                      <td>
                        <div className="co-customer">
                          <span
                            className="co-initials"
                            style={{ background: bgColor, color: textColor }}
                          >
                            {initials(cName)}
                          </span>
                          <span>{cName}</span>
                        </div>
                      </td>

                      <td className="co-td-service">
                        <div>{serviceName(order)}</div>
                        {categoryName(order) ? <small>{categoryName(order)}</small> : null}
                      </td>

                      <td>
                        {pName ? (
                          <div className="co-provider">
                            {order.provider?.photoUrl ? (
                              <img src={order.provider.photoUrl} alt={pName} />
                            ) : (
                              <span className="co-unknown-dot">{initials(pName)}</span>
                            )}
                            <span>{pName}</span>
                          </div>
                        ) : (
                          <div className="co-unassigned">
                            <span className="co-unknown-dot">?</span>
                            <span>Unassigned</span>
                          </div>
                        )}
                      </td>

                      <td>
                        <span className={`co-status-pill ${cls}`}>
                          <span className="co-pill-dot" />
                          {label}
                        </span>
                      </td>

                      <td className="co-td-amount right">{priceOf(order)} TND</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="co-pagination">
          <span>
            Showing <strong>{rangeFrom}–{rangeTo}</strong> of <strong>{total}</strong> orders
          </span>
          <div className="co-page-btns">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <FaChevronLeft />
            </button>
            {pageButtons.map((p) => (
              <button
                key={p}
                className={p === page ? 'active' : ''}
                onClick={() => setPage(p)}
              >
                {p + 1}
              </button>
            ))}
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* Order Details Drawer */}
      {selectedId ? (
        <>
          <div className="co-drawer-backdrop" onClick={closeDrawer} />
          <aside className="co-drawer">
            {detailLoading || !detail ? (
              <div className="co-drawer-loading">
                {detailLoading ? 'Loading details…' : 'Could not load this order.'}
              </div>
            ) : (
              <>
                {(() => {
                  const slot = effectiveSlot(detail)
                  return (
                <>
                {/* Header */}
                <div className="co-drawer-header">
                  <div>
                    <div className="co-drawer-title-row">
                      <h2>#{detail.id.slice(0, 8)}</h2>
                      <span className={`co-status-pill ${STATUS_CONFIG[detail.status].cls}`}>
                        <span className="co-pill-dot" />
                        {STATUS_CONFIG[detail.status].label}
                      </span>
                    </div>
                    <div className="co-drawer-meta">
                      {slot.isProposed ? (
                        <>
                          <span>
                            <FaRegCalendar /> Was {formatDate(detail.scheduledDate)}
                          </span>
                          <span>
                            <FaRegClock /> Proposed {formatDate(slot.date)} at {slot.time}
                          </span>
                        </>
                      ) : (
                        <>
                          <span><FaRegCalendar /> {formatDate(slot.date)}</span>
                          <span><FaRegClock /> {slot.time}</span>
                        </>
                      )}
                      {detail.latitude != null && detail.longitude != null ? (
                        <span>
                          <FaLocationDot />{' '}
                          {detail.latitude.toFixed(3)}, {detail.longitude.toFixed(3)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="co-drawer-head-actions">
                    <button onClick={closeDrawer}><FaXmark /></button>
                  </div>
                </div>

                {/* Body */}
                <div className="co-drawer-body">
                  {detail.status === 'RESCHEDULED' ? (
                    <div className="co-pipeline-banner co-pipeline-banner-wait">
                      <strong>Awaiting client response</strong>
                      <p>
                        The customer must accept or decline the proposed time before you
                        can assign a provider or confirm the order.
                      </p>
                    </div>
                  ) : null}
                  {detail.status === 'PENDING' && !detail.confirmedAt ? (
                    <div className="co-pipeline-banner co-pipeline-banner-ready">
                      <strong>Action required</strong>
                      <p>
                        {detail.providerId
                          ? 'Confirm the order when ready, or reassign if you need a different employee.'
                          : 'Assign an employee who offers this service and is free at the scheduled time, then confirm the order.'}
                      </p>
                    </div>
                  ) : null}

                  {/* Customer + Provider */}
                  <div className="co-info-grid">
                    <div className="co-info-card">
                      <small>Customer</small>
                      <div className="co-info-person">
                        <span
                          className="co-initials co-initials-lg"
                          style={(() => {
                            const [bg, fg] = colorFor(clientName(detail)).split('|')
                            return { background: bg, color: fg }
                          })()}
                        >
                          {initials(clientName(detail))}
                        </span>
                        <div>
                          <strong>{clientName(detail)}</strong>
                          <span>{detail.client?.user?.phoneNumber ?? detail.client?.user?.email ?? ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="co-info-card co-provider-card">
                      <div className="co-provider-deco" />
                      <small>Provider</small>
                      {detail.provider ? (
                        <>
                          <div className="co-info-person">
                            {detail.provider.photoUrl ? (
                              <img src={detail.provider.photoUrl} alt={providerName(detail) ?? ''} />
                            ) : (
                              <span className="co-initials co-initials-lg" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                                {initials(providerName(detail) ?? '')}
                              </span>
                            )}
                            <div>
                              <strong>{providerName(detail)}</strong>
                              <span>
                                {detail.status === 'RESCHEDULED'
                                  ? 'Client preference — confirm after acceptance'
                                  : 'Assigned'}
                              </span>
                            </div>
                          </div>
                          {canAssignProvider(detail) ? (
                            <button
                              className="co-reassign-btn"
                              onClick={() => openAssign(detail.id)}
                            >
                              Reassign Provider
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="co-info-person">
                            <span className="co-unknown-dot co-unknown-lg">?</span>
                            <div>
                              <strong>Unassigned</strong>
                              <span className="co-unassigned-text">No provider yet</span>
                            </div>
                          </div>
                          {canAssignProvider(detail) ? (
                            <button
                              className="co-reassign-btn"
                              onClick={() => openAssign(detail.id)}
                            >
                              <FaUserPlus /> Assign Provider
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Service Details */}
                  <div className="co-service-card">
                    <div className="co-service-card-head">
                      <span>Service Details</span>
                      <span>Total: {priceOf(detail)} TND</span>
                    </div>
                    <div className="co-service-card-body">
                      <div className="co-service-row">
                        <div>
                          <strong>{serviceName(detail)}</strong>
                          <small>
                            {detail.givenService?.estimatedDurationMinutes
                              ? `${detail.givenService.estimatedDurationMinutes} mins`
                              : ''}
                            {categoryName(detail) ? ` • ${categoryName(detail)}` : ''}
                          </small>
                        </div>
                        <span>{priceOf(detail)} TND</span>
                      </div>
                      {detail.notes ? (
                        <div className="co-payment-row">
                          <span>Notes</span>
                          <span>{detail.notes}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Refusal reason (if refused) */}
                  {detail.status === 'REFUSED' && detail.refusalReason ? (
                    <div className="co-dispute-card">
                      <div className="co-dispute-title">
                        <h3>Refusal Reason</h3>
                      </div>
                      <p>{detail.refusalReason}</p>
                    </div>
                  ) : null}

                  {/* Reschedule proposal (if rescheduled) */}
                  {detail.status === 'RESCHEDULED' && detail.rescheduleDate ? (
                    <div className="co-service-card co-proposed-time-card">
                      <div className="co-service-card-head">
                        <span>Proposed New Time</span>
                        <span className="co-proposed-badge">Pending client</span>
                      </div>
                      <div className="co-service-card-body">
                        <div className="co-service-row">
                          <div>
                            <strong>{formatDate(detail.rescheduleDate)}</strong>
                            <small>
                              Replaces {formatDate(detail.scheduledDate)} at{' '}
                              {detail.scheduledTime}
                            </small>
                          </div>
                          <span>{detail.rescheduleTime}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Inline action forms */}
                  {actionMode === 'refuse' ? (
                    <div className="co-action-form">
                      <label>Reason for refusal (optional)</label>
                      <textarea
                        value={refusalReason}
                        placeholder="Let the customer know why…"
                        onChange={(e) => setRefusalReason(e.target.value)}
                      />
                      <div className="co-action-form-btns">
                        <button className="co-btn-ghost" onClick={() => setActionMode(null)}>
                          Cancel
                        </button>
                        <button
                          className="co-btn-danger"
                          disabled={submitting}
                          onClick={() => handleRefuse(detail)}
                        >
                          {submitting ? 'Refusing…' : 'Confirm Refuse'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {actionMode === 'reschedule' ? (
                    <div className="co-action-form">
                      <label>Propose a new date &amp; time</label>
                      <p className="co-reschedule-hint">
                        Pick a future date, then choose a time when at least one
                        employee can perform this service.
                      </p>
                      <div className="co-reschedule-inputs">
                        <div className="co-reschedule-field">
                          <span>Date</span>
                          <input
                            type="date"
                            min={rescheduleMinDate}
                            value={rescheduleDate}
                            disabled={rescheduleOptionsLoading}
                            onChange={(e) => {
                              const nextDate = e.target.value
                              if (!nextDate || !selectedId) return
                              setRescheduleDate(nextDate)
                              void loadRescheduleSlots(selectedId, nextDate)
                            }}
                          />
                        </div>
                        <div className="co-reschedule-field">
                          <span>Time</span>
                          <select
                            value={rescheduleTime}
                            disabled={
                              rescheduleOptionsLoading ||
                              rescheduleSlots.length === 0
                            }
                            onChange={(e) => setRescheduleTime(e.target.value)}
                          >
                            {rescheduleSlots.length === 0 ? (
                              <option value="">
                                {rescheduleOptionsLoading
                                  ? 'Loading…'
                                  : 'No slots'}
                              </option>
                            ) : (
                              rescheduleSlots.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>
                      {rescheduleOptionsLoading ? (
                        <div className="co-reschedule-loading">
                          Loading available slots…
                        </div>
                      ) : null}
                      {rescheduleOptionsError ? (
                        <div className="co-reschedule-empty">{rescheduleOptionsError}</div>
                      ) : null}
                      {!rescheduleOptionsLoading &&
                      !rescheduleOptionsError &&
                      rescheduleDate &&
                      rescheduleSlots.length === 0 ? (
                        <div className="co-reschedule-empty">
                          No employees are free on this day. Try another date or
                          update team schedules.
                        </div>
                      ) : null}
                      <div className="co-action-form-btns">
                        <button
                          className="co-btn-ghost"
                          onClick={() => {
                            setActionMode(null)
                            setRescheduleSlots([])
                            setRescheduleOptionsError(null)
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="co-btn-primary"
                          disabled={
                            submitting ||
                            rescheduleOptionsLoading ||
                            !rescheduleDate ||
                            !rescheduleTime
                          }
                          onClick={() => handleReschedule(detail)}
                        >
                          {submitting
                            ? 'Sending…'
                            : detail.status === 'RESCHEDULED'
                              ? 'Update Proposal'
                              : 'Send Proposal'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Action footer */}
                {actionMode === null &&
                (detail.status === 'PENDING' || detail.status === 'RESCHEDULED') ? (
                  <div className="co-drawer-footer">
                    <button
                      className="co-btn-ghost co-btn-grow"
                      disabled={submitting}
                      onClick={() => {
                        setActionMode('refuse')
                        setRefusalReason('')
                      }}
                    >
                      Refuse
                    </button>
                    <button
                      className="co-btn-ghost co-btn-grow"
                      disabled={submitting}
                      onClick={() => setActionMode('reschedule')}
                    >
                      {detail.status === 'RESCHEDULED'
                        ? 'Update Proposal'
                        : 'Reschedule'}
                    </button>
                    {detail.status === 'PENDING' ? (
                      <button
                        className="co-btn-primary co-btn-grow"
                        disabled={submitting}
                        onClick={() => handleConfirm(detail)}
                      >
                        {detail.providerId ? 'Accept' : 'Assign & Accept'}
                      </button>
                    ) : (
                      <span className="co-footer-hint co-btn-grow">
                        Waiting for the client…
                      </span>
                    )}
                  </div>
                ) : null}
                </>
                  )
                })()}
              </>
            )}
          </aside>
        </>
      ) : null}

      {/* Assign / Reassign Modal */}
      {assignOpen ? (
        <div className="co-modal-overlay" onClick={() => setAssignOpen(false)}>
          <div className="co-modal" onClick={(e) => e.stopPropagation()}>
            <div className="co-modal-header">
              <h3>Assign Provider</h3>
              <button onClick={() => setAssignOpen(false)}><FaXmark /></button>
            </div>
            <div className="co-modal-body">
              {detail ? (
                <p className="co-assign-context">
                  {serviceName(detail)} ·{' '}
                  {(() => {
                    const slot = effectiveSlot(detail)
                    return `${formatDate(slot.date)} at ${slot.time}`
                  })()}
                </p>
              ) : null}
              <label className="co-confirm-toggle">
                <input
                  type="checkbox"
                  checked={confirmOnAssign}
                  onChange={(e) => setConfirmOnAssign(e.target.checked)}
                />
                <span>Confirm the appointment after assigning</span>
              </label>
              <div className="co-form-group">
                <label>
                  Employees who offer this service and are free at this time
                </label>
                <div className="co-provider-list">
                  {providersLoading ? (
                    <div className="co-provider-empty">Checking availability…</div>
                  ) : availableProviders.length === 0 ? (
                    <div className="co-provider-empty">
                      No employee offers this service and is available for this slot.
                    </div>
                  ) : (
                    availableProviders.map((p) => (
                      <div key={p.id} className="co-provider-option">
                        <div className="co-prov-left">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt={p.displayName} />
                          ) : (
                            <span className="co-initials" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                              {initials(p.displayName)}
                            </span>
                          )}
                          <div>
                            <span>{p.displayName}</span>
                            <small className="avail">
                              Available
                              {p.city ? ` · ${p.city}` : ''}
                              {p.averageRating > 0 ? (
                                <>
                                  {' · '}
                                  <FaStar style={{ color: '#f59e0b', fontSize: 9 }} />{' '}
                                  {p.averageRating.toFixed(1)}
                                </>
                              ) : null}
                            </small>
                          </div>
                        </div>
                        <button
                          className="co-select-btn"
                          disabled={submitting}
                          onClick={() => handleAssign(p.id)}
                        >
                          Select
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="co-modal-footer">
              <button className="co-btn-ghost" onClick={() => setAssignOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
