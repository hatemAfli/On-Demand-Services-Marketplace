import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AxiosError } from 'axios'
import {
  FaArrowRight,
  FaArrowRotateRight,
  FaArrowTrendDown,
  FaArrowTrendUp,
  FaBoxesStacked,
  FaChartLine,
  FaClipboardCheck,
  FaEnvelope,
  FaMedal,
  FaPlus,
  FaStar,
  FaTriangleExclamation,
  FaUserGroup,
} from 'react-icons/fa6'
import companyApi from '../../../../services/companyApi'
import type { CompanyDashboardData } from '../../../../types/company'
import {
  avatarColor,
  formatMoney,
  formatRelativeTime,
  formatTrend,
  providerInitials,
  STATUS_UI,
} from './dashboardUtils'
import './CompanyDashboardPage.css'

const REFRESH_MS = 90_000

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
  }
  return fallback
}

export function CompanyDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<CompanyDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const brand = '#7621C2'

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await companyApi.getCompanyDashboard()
      setData(res)
      document.documentElement.style.setProperty('--company-brand', brand)
    } catch (err) {
      setError(errorMessage(err, 'Could not load dashboard'))
      if (!silent) setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
    const id = window.setInterval(() => void load(true), REFRESH_MS)
    return () => window.clearInterval(id)
  }, [load])

  const trendLabel = useMemo(
    () => (data ? formatTrend(data.orders.trendPct) : null),
    [data],
  )

  const trendUp =
    data?.orders.trendPct != null && data.orders.trendPct >= 0

  if (loading && !data) {
    return (
      <div className="company-dashboard company-dashboard--loading">
        <div className="cd-loading-card">
          <div className="cd-loading-spinner" />
          <p>Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="company-dashboard">
        <div className="cd-error-card">
          <FaTriangleExclamation />
          <p>{error}</p>
          <button type="button" onClick={() => void load(false)}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const primaryAlert = data.alerts[0]

  return (
    <div className="company-dashboard">
      <div className="cd-toolbar">
        <button
          type="button"
          className="cd-refresh-btn"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          <FaArrowRotateRight className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {primaryAlert ? (
        <button
          type="button"
          className={`cd-alert-banner cd-alert-banner--${primaryAlert.tone}`}
          onClick={() => navigate(primaryAlert.path)}
        >
          <FaTriangleExclamation />
          <div>
            <strong>{primaryAlert.title}</strong>
            <span>{primaryAlert.message}</span>
          </div>
          <FaArrowRight />
        </button>
      ) : null}

      <section className="company-kpi-grid">
        <article className="company-kpi-card cd-kpi-card">
          <div className="company-kpi-bg-icon">
            <FaClipboardCheck />
          </div>
          <div className="company-kpi-head">
            <div className="company-kpi-icon purple">
              <FaBoxesStacked />
            </div>
            {trendLabel ? (
              <span
                className={`company-kpi-trend ${trendUp ? 'up' : 'down'}`}
              >
                {trendUp ? <FaArrowTrendUp /> : <FaArrowTrendDown />}
                {trendLabel}
              </span>
            ) : null}
          </div>
          <h3>Today&apos;s orders</h3>
          <div className="company-kpi-value-wrap">
            <strong>{data.orders.today}</strong>
            <span>{data.orders.yesterday} yesterday</span>
          </div>
          <div className="company-kpi-progress">
            <span
              style={{
                width: `${data.orders.today === 0 ? 0 : Math.min(100, (data.orders.todayCompleted / data.orders.today) * 100)}%`,
                background: brand,
              }}
            />
          </div>
          <div className="company-kpi-foot">
            <span>Pending: {data.orders.todayPending}</span>
            <span>Completed: {data.orders.todayCompleted}</span>
          </div>
        </article>

        <article className="company-kpi-card cd-kpi-card">
          <div className="company-kpi-bg-icon">
            <FaUserGroup />
          </div>
          <div className="company-kpi-head">
            <div className="company-kpi-icon blue">
              <FaUserGroup />
            </div>
            <span className="company-kpi-cap">
              {data.team.activeServices} services
            </span>
          </div>
          <h3>Your team</h3>
          <div className="company-kpi-value-wrap">
            <strong>{data.team.employeeCount}</strong>
            <span>employee providers</span>
          </div>
          <div className="cd-kpi-mini-stats">
            <span>
              <em>{data.orders.inProgress}</em> in progress
            </span>
            <span>
              <em>{data.orders.pendingAssignment}</em> to assign
            </span>
          </div>
        </article>

        <article className="company-kpi-card cd-kpi-card">
          <div className="company-kpi-bg-icon">
            <FaChartLine />
          </div>
          <div className="company-kpi-head">
            <div className="company-kpi-icon green">
              <FaStar />
            </div>
            <span className="company-kpi-trend up">
              {data.ratings.averageRating.toFixed(1)} ★
            </span>
          </div>
          <h3>Rating & revenue</h3>
          <div className="company-kpi-value-wrap">
            <strong>{formatMoney(data.todayRevenue)}</strong>
            <span>completed today (est.)</span>
          </div>
          <div className="company-kpi-mini-grid">
            <div>
              <small>Reviews</small>
              <span>{data.ratings.totalReviews}</span>
            </div>
            <div>
              <small>Open complaints</small>
              <span>{data.complaints.total}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="company-quick-actions">
        <button type="button" onClick={() => navigate('/company/services')}>
          <span className="quick-icon purple">
            <FaPlus />
          </span>
          <h4>Services</h4>
          <p>Manage offerings</p>
        </button>
        <button type="button" onClick={() => navigate('/company/providers')}>
          <span className="quick-icon blue">
            <FaEnvelope />
          </span>
          <h4>Invite provider</h4>
          <p>Grow your team</p>
        </button>
        <button type="button" onClick={() => navigate('/company/complaints')}>
          <span className="quick-icon orange">
            <FaTriangleExclamation />
          </span>
          <h4>Complaints</h4>
          <p>
            {data.complaints.total > 0
              ? `${data.complaints.total} open`
              : 'All clear'}
          </p>
        </button>
        <button type="button" onClick={() => navigate('/company/orders')}>
          <span className="quick-icon green">
            <FaClipboardCheck />
          </span>
          <h4>Orders</h4>
          <p>{data.orders.activeLive} active now</p>
        </button>
      </section>

      <section className="company-main-grid">
        <div className="company-left-column">
          <article className="company-card">
            <div className="company-card-head">
              <div>
                <h3>Live orders</h3>
                <p>Needs action — updates every {REFRESH_MS / 1000}s</p>
              </div>
              <button
                type="button"
                className="purple-soft"
                onClick={() => navigate('/company/orders')}
              >
                View all
              </button>
            </div>

            {data.liveOrders.length === 0 ? (
              <div className="cd-empty-inline">
                <FaClipboardCheck />
                <p>No active orders right now. New bookings will appear here.</p>
              </div>
            ) : (
              <div className="company-orders-table-wrap">
                <table className="company-orders-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Service & client</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.liveOrders.map((o) => {
                      const st = STATUS_UI[o.status]
                      const colors = o.providerName
                        ? avatarColor(o.providerName)
                        : null
                      return (
                        <tr key={o.id}>
                          <td>
                            <div className="order-id">#{o.shortId}</div>
                            <div className="order-time">
                              {o.scheduledDate} · {o.scheduledTime}
                            </div>
                          </td>
                          <td>
                            <div className="service-cell">
                              <div className="service-icon">
                                <FaClipboardCheck />
                              </div>
                              <div>
                                <div className="service-name">
                                  {o.serviceName}
                                </div>
                                <div className="service-meta">{o.clientName}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {o.providerName ? (
                              <div className="provider-cell">
                                {o.providerPhotoUrl ? (
                                  <img
                                    src={o.providerPhotoUrl}
                                    alt=""
                                  />
                                ) : (
                                  <span
                                    className="provider-fallback"
                                    style={{
                                      background: colors?.bg,
                                      color: colors?.fg,
                                    }}
                                  >
                                    {providerInitials(o.providerName)}
                                  </span>
                                )}
                                <span>{o.providerName}</span>
                              </div>
                            ) : (
                              <div className="provider-cell">
                                <span className="provider-fallback muted">
                                  —
                                </span>
                                <span className="provider-empty">
                                  Unassigned
                                </span>
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${st.tone}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="right">
                            {o.needsAssignment ? (
                              <button
                                type="button"
                                className="assign-btn"
                                onClick={() => navigate('/company/orders')}
                              >
                                Assign
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="assign-btn outline"
                                onClick={() => navigate('/company/orders')}
                              >
                                Open
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <div className="cd-charts-row">
            <article className="company-card chart-card cd-chart-half">
              <div className="company-card-head">
                <div>
                  <h3>Orders this week</h3>
                  <p>Scheduled bookings per day</p>
                </div>
              </div>
              <div className="company-chart-wrap cd-chart-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ordersTrend}>
                    <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="orders"
                      fill={brand}
                      radius={[6, 6, 0, 0]}
                      name="Orders"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="company-card chart-card cd-chart-half">
              <div className="company-card-head">
                <div>
                  <h3>Revenue estimate</h3>
                  <p>Completed jobs (7 days)</p>
                </div>
              </div>
              <div className="company-chart-wrap cd-chart-sm">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueTrend}>
                    <defs>
                      <linearGradient id="cdRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={brand} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={brand} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatMoney(Number(v))}
                    />
                    <Tooltip
                      formatter={(v) => [formatMoney(Number(v ?? 0)), 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke={brand}
                      strokeWidth={2.5}
                      fill="url(#cdRevenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </div>

        <div className="company-right-column">
          <article className="company-card cd-rating-card">
            <div className="cd-rating-ring" style={{ borderColor: brand }}>
              <FaStar style={{ color: brand }} />
              <strong>{data.company.averageRating.toFixed(1)}</strong>
              <small>{data.company.totalReviews} reviews</small>
            </div>
            <div className="cd-rating-meta">
              <p>
                Cancellation rate{' '}
                <strong>{data.company.cancellationRate.toFixed(1)}%</strong>
              </p>
              {data.company.averageResponseTime != null ? (
                <p>
                  Avg. response{' '}
                  <strong>
                    {Math.round(data.company.averageResponseTime)} min
                  </strong>
                </p>
              ) : null}
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/company/ratings')}
              >
                View ratings
              </button>
            </div>
          </article>

          <article className="company-card">
            <div className="company-card-head compact">
              <h3>Top providers</h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate('/company/providers')}
              >
                View all
              </button>
            </div>
            {data.topProviders.length === 0 ? (
              <div className="cd-empty-inline small">
                <p>No employees yet. Invite your first provider.</p>
              </div>
            ) : (
              <div className="provider-ranking-list">
                {data.topProviders.map((p) => {
                  const colors = avatarColor(p.displayName)
                  return (
                    <div key={p.id} className="provider-ranking-item">
                      <div className="provider-main">
                        <div className="provider-avatar-wrap">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt="" />
                          ) : (
                            <span
                              className="cd-provider-initials"
                              style={{
                                background: colors.bg,
                                color: colors.fg,
                              }}
                            >
                              {providerInitials(p.displayName)}
                            </span>
                          )}
                          {p.rank === 1 ? (
                            <span className="medal-dot">
                              <FaMedal />
                            </span>
                          ) : null}
                        </div>
                        <div>
                          <div className="provider-name">{p.displayName}</div>
                          <div className="provider-meta">
                            {p.completedJobs} jobs · {p.averageRating.toFixed(1)}{' '}
                            <FaStar />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          <article className="company-card">
            <div className="company-card-head compact">
              <h3>Recent activity</h3>
            </div>
            {data.activity.length === 0 ? (
              <div className="cd-empty-inline small">
                <p>Team actions will show up here.</p>
              </div>
            ) : (
              <div className="notice-list">
                {data.activity.map((item, i) => (
                  <div
                    key={item.id}
                    className={`notice-item${i === 0 ? ' active' : ''}`}
                  >
                    <span
                      className={`notice-dot ${i === 0 ? 'purple' : 'gray'}`}
                    />
                    <div>
                      <h4>{item.summary}</h4>
                      <p>
                        {item.actorName} · {item.action.replace(/_/g, ' ')}
                      </p>
                      <small>{formatRelativeTime(item.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          {data.alerts.length > 1 ? (
            <article className="company-card cd-more-alerts">
              <h4>More alerts</h4>
              <ul>
                {data.alerts.slice(1).map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => navigate(a.path)}>
                      <span>{a.title}</span>
                      <FaArrowRight />
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      </section>

      <p className="cd-generated-at">
        Last updated {formatRelativeTime(data.generatedAt)}
      </p>
    </div>
  )
}
