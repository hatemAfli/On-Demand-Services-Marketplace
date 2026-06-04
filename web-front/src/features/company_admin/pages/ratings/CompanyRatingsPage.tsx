import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  FaArrowTrendDown,
  FaArrowTrendUp,
  FaCircleQuestion,
  FaFilter,
  FaMagnifyingGlass,
  FaMedal,
  FaRotateLeft,
  FaStar,
  FaTriangleExclamation,
  FaUsers,
  FaXmark,
} from 'react-icons/fa6'
import { FaCommentDots, FaRegStar } from 'react-icons/fa'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyReview,
  CompanyReviewBreakdownRow,
  CompanyReviewByService,
  CompanyReviewStats,
  CompanyReviewTrendPoint,
  CompanyTopRatedProvider,
  ListCompanyReviewsParams,
} from '../../../../types/company'
import './CompanyRatingsPage.css'

const REVIEW_PAGE_SIZE = 8
const SERVICE_COLORS = ['#10B981', '#7621C2', '#3B82F6', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6']

const AVATAR_COLORS = [
  '#bfdbfe|#2563eb',
  '#e9d5ff|#9333ea',
  '#bbf7d0|#16a34a',
  '#fed7aa|#ea580c',
  '#fbcfe8|#db2777',
  '#a5f3fc|#0891b2',
]

type ReviewSort = ListCompanyReviewsParams['sort']

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
  }
  return fallback
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function colorFor(seed: string): { bg: string; fg: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  const [bg, fg] = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length].split('|')
  return { bg, fg }
}

function clientName(review: CompanyReview): string {
  const u = review.client?.user
  if (!u) return 'Client'
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Client'
}

function providerDisplayName(review: CompanyReview): string | null {
  const u = review.provider?.user
  if (!u) return null
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null
}

function reviewServiceName(review: CompanyReview): string {
  return review.givenService?.service?.translations?.[0]?.name ?? 'Service'
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAppointmentRef(review: CompanyReview): string {
  const id = review.appointment?.id
  if (!id) return '—'
  return `#${id.slice(0, 8).toUpperCase()}`
}

function perfBadge(provider: CompanyTopRatedProvider): { label: string; cls: string } | null {
  if (provider.isTopProvider) return { label: 'Top rated', cls: 'green' }
  if (provider.averageRating >= 4.5 && provider.totalReviews >= 5) {
    return { label: 'Consistent', cls: 'blue' }
  }
  if (provider.totalReviews < 5 && provider.averageRating >= 4) {
    return { label: 'Rising star', cls: 'purple' }
  }
  return null
}

function StarRow({ count, total = 5, color = '#FACC15' }: { count: number; total?: number; color?: string }) {
  const filled = Math.round(Math.min(Math.max(count, 0), total))
  return (
    <div className="rr-stars">
      {Array.from({ length: total }).map((_, i) => (
        i < filled
          ? <FaStar key={i} style={{ color }} />
          : <FaRegStar key={i} style={{ color: '#d1d5db' }} />
      ))}
    </div>
  )
}

export function CompanyRatingsPage() {
  const navigate = useNavigate()

  const [stats, setStats] = useState<CompanyReviewStats | null>(null)
  const [breakdown, setBreakdown] = useState<CompanyReviewBreakdownRow[]>([])
  const [trends, setTrends] = useState<CompanyReviewTrendPoint[]>([])
  const [byService, setByService] = useState<CompanyReviewByService[]>([])
  const [topProviders, setTopProviders] = useState<CompanyTopRatedProvider[]>([])
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [reviewsTotal, setReviewsTotal] = useState(0)

  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [lowRatingOnly, setLowRatingOnly] = useState(false)
  const [reviewSort, setReviewSort] = useState<ReviewSort>('recent')
  const [showFilters, setShowFilters] = useState(false)

  const [selectedReview, setSelectedReview] = useState<CompanyReview | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  const serviceChartData = useMemo(
    () => byService.map((s, i) => ({
      ...s,
      service: s.serviceName,
      color: SERVICE_COLORS[i % SERVICE_COLORS.length],
    })),
    [byService],
  )

  const selectedServiceName = useMemo(() => {
    if (!selectedServiceId) return null
    return byService.find((s) => s.serviceId === selectedServiceId)?.serviceName ?? null
  }, [byService, selectedServiceId])

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const params: ListCompanyReviewsParams = {
        take: REVIEW_PAGE_SIZE,
        skip: 0,
        sort: reviewSort,
        ...(selectedServiceId ? { serviceId: selectedServiceId } : {}),
        ...(lowRatingOnly ? { maxRating: 2 } : {}),
      }
      const data = await companyApi.getCompanyReviews(params)
      setReviews(data.items)
      setReviewsTotal(data.total)
    } catch (err) {
      setError(errorMessage(err, 'Could not load reviews.'))
    } finally {
      setReviewsLoading(false)
    }
  }, [lowRatingOnly, reviewSort, selectedServiceId])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsData, breakdownData, trendsData, byServiceData, topData] = await Promise.all([
        companyApi.getCompanyReviewStats(),
        companyApi.getCompanyReviewBreakdown(),
        companyApi.getCompanyReviewTrends(),
        companyApi.getCompanyReviewsByService(),
        companyApi.getCompanyTopRatedProviders(),
      ])
      setStats(statsData)
      setBreakdown(breakdownData)
      setTrends(trendsData)
      setByService(byServiceData)
      setTopProviders(topData)
    } catch (err) {
      setError(errorMessage(err, 'Could not load ratings dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const openReviewDrawer = async (review: CompanyReview) => {
    setSelectedReview(review)
    setDrawerLoading(true)
    try {
      const full = await companyApi.getCompanyReviewById(review.id)
      setSelectedReview(full)
    } catch {
      // keep list item data
    } finally {
      setDrawerLoading(false)
    }
  }

  const resetFilters = () => {
    setSelectedServiceId(null)
    setLowRatingOnly(false)
  }

  const trendDomain = useMemo(() => {
    if (trends.length === 0) return [0, 5] as [number, number]
    const values = trends.map((t) => t.rating).filter((r) => r > 0)
    if (values.length === 0) return [0, 5] as [number, number]
    const min = Math.max(0, Math.floor(Math.min(...values) * 10) / 10 - 0.5)
    const max = Math.min(5, Math.ceil(Math.max(...values) * 10) / 10 + 0.2)
    return [min, max] as [number, number]
  }, [trends])

  const monthlyTrend = stats?.monthlyChange ?? 0

  if (loading && !stats) {
    return (
      <div className="rr-root">
        <div className="rr-loading">Loading ratings…</div>
      </div>
    )
  }

  return (
    <div className="rr-root">
      {error ? <div className="rr-error-banner">{error}</div> : null}

      {/* KPI cards */}
      <div className="rr-kpi-grid">
        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Company rating</p>
              <div className="rr-kpi-val-row">
                <h3>{(stats?.companyAverageRating ?? 0).toFixed(1)}</h3>
                <span className="rr-kpi-sub">/ 5.0</span>
              </div>
            </div>
            <div className="rr-kpi-icon yellow"><FaStar /></div>
          </div>
          <StarRow count={stats?.companyAverageRating ?? 0} />
          <p className="rr-kpi-hint">Average of {stats?.employeeCount ?? 0} employee ratings</p>
          <div className="rr-kpi-trend">
            {monthlyTrend !== 0 ? (
              <span className={`rr-badge ${monthlyTrend >= 0 ? 'green' : 'red'}`}>
                {monthlyTrend >= 0 ? <FaArrowTrendUp /> : <FaArrowTrendDown />}
                {monthlyTrend >= 0 ? '+' : ''}{monthlyTrend.toFixed(1)}
              </span>
            ) : (
              <span className="rr-muted">No change vs prior 30 days</span>
            )}
          </div>
        </div>

        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Total reviews</p>
              <h3>{stats?.totalReviews ?? 0}</h3>
            </div>
            <div className="rr-kpi-icon purple"><FaCommentDots /></div>
          </div>
          <p className="rr-kpi-hint">
            {stats?.reviewCount ?? 0} visible on your team profile
          </p>
          <div className="rr-kpi-trend">
            <span className="rr-muted">
              Avg. per review: {(stats?.averageReviewRating ?? 0).toFixed(1)} ★
            </span>
          </div>
        </div>

        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Response rate</p>
              <h3>{stats?.responseRate ?? 0}%</h3>
            </div>
            <div className="rr-kpi-icon blue"><FaMedal /></div>
          </div>
          <div className="rr-nps-bar-track">
            <div
              className="rr-nps-bar-fill"
              style={{ width: `${stats?.responseRate ?? 0}%`, background: 'linear-gradient(to right, #60a5fa, #2563eb)' }}
            />
          </div>
          <p className="rr-response-time">
            <strong>{stats?.withReply ?? 0}</strong> of {stats?.reviewCount ?? 0} reviews replied by staff
          </p>
        </div>

        <div className="rr-kpi-card">
          <div className="rr-kpi-top">
            <div>
              <p>Needs attention</p>
              <h3>{stats?.lowRatingCount ?? 0}</h3>
            </div>
            <div className="rr-kpi-icon red"><FaTriangleExclamation /></div>
          </div>
          <p className="rr-kpi-hint">Reviews rated 1–2 stars</p>
          {(stats?.lowRatingCount ?? 0) > 0 ? (
            <button
              type="button"
              className="rr-view-alerts-btn"
              onClick={() => setLowRatingOnly(true)}
            >
              View low ratings
            </button>
          ) : (
            <div className="rr-kpi-trend">
              <span className="rr-badge green">All clear</span>
            </div>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="rr-main-grid">
        <div className="rr-left-col">
          {/* Trend chart */}
          <div className="rr-chart-card">
            <div className="rr-chart-head">
              <div>
                <h3>Rating trends</h3>
                <p>Weekly average over the last 8 weeks</p>
              </div>
              <div className="rr-kpi-icon purple rr-inline-icon"><FaUsers /></div>
            </div>
            {trends.length === 0 ? (
              <div className="rr-chart-empty">No reviews in the selected period yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trends} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={trendDomain} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                    formatter={(v) => [Number(v).toFixed(1), 'Avg rating']}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as CompanyReviewTrendPoint | undefined
                      return row ? `${row.label} (${row.count} reviews)` : ''
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#7621C2"
                    strokeWidth={3}
                    dot={{ fill: '#fff', stroke: '#7621C2', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Breakdown + Service chart */}
          <div className="rr-mid-grid">
            <div className="rr-panel">
              <h3>Star breakdown</h3>
              <p>Distribution of all employee reviews</p>
              <div className="rr-sentiment-list">
                {breakdown.map((row) => (
                  <div key={row.star} className="rr-sentiment-item">
                    <div className="rr-sentiment-head">
                      <span><FaStar className="rr-icon yellow" /> {row.star} star{row.star !== 1 ? 's' : ''}</span>
                      <span>{row.count} ({row.percentage}%)</span>
                    </div>
                    <div className="rr-bar-track">
                      <div
                        className="rr-bar-fill"
                        style={{
                          width: `${row.percentage}%`,
                          background: row.star <= 2 ? '#EF4444' : row.star === 3 ? '#F59E0B' : '#22C55E',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rr-panel">
              <div className="rr-panel-head">
                <div>
                  <h3>By service</h3>
                  <p>Click a bar to filter reviews</p>
                </div>
                {(selectedServiceId || lowRatingOnly) ? (
                  <button type="button" className="rr-reset-btn" onClick={resetFilters}>
                    <FaRotateLeft /> Reset
                  </button>
                ) : null}
              </div>
              {serviceChartData.length === 0 ? (
                <div className="rr-chart-empty rr-chart-empty-sm">No service reviews yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={serviceChartData}
                    margin={{ top: 4, right: 8, bottom: 4, left: -10 }}
                    barCategoryGap="40%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="service"
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)}
                    />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 11 }}
                      formatter={(v) => [Number(v).toFixed(1), 'Rating']}
                      cursor={{ fill: 'rgba(118,33,194,0.04)' }}
                    />
                    <Bar dataKey="averageRating" radius={[6, 6, 0, 0]} cursor="pointer">
                      {serviceChartData.map((entry) => (
                        <Cell
                          key={entry.serviceId}
                          fill={entry.color}
                          opacity={
                            selectedServiceId && entry.serviceId !== selectedServiceId ? 0.35 : 0.85
                          }
                          onClick={() => setSelectedServiceId(entry.serviceId)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Providers table */}
          <div className="rr-table-card">
            <div className="rr-table-head">
              <div>
                <h3>Top providers</h3>
                <p>Highest rated team members</p>
              </div>
              <button
                type="button"
                className="rr-view-all-btn"
                onClick={() => navigate('/company/providers')}
              >
                View all providers
              </button>
            </div>
            <div className="rr-table-scroll">
              {topProviders.length === 0 ? (
                <div className="rr-chart-empty">No employee ratings yet.</div>
              ) : (
                <table className="rr-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Rating</th>
                      <th className="right">Reviews</th>
                      <th className="right">Jobs</th>
                      <th className="right">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProviders.map((p) => {
                      const badge = perfBadge(p)
                      const provColors = colorFor(p.id)
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="rr-prov-cell">
                              {p.photoUrl ? (
                                <img src={p.photoUrl} alt={p.displayName} />
                              ) : (
                                <span
                                  className="rr-initials rr-initials-sm"
                                  style={{ background: provColors.bg, color: provColors.fg }}
                                >
                                  {initials(p.displayName)}
                                </span>
                              )}
                              <div>
                                <strong>{p.displayName}</strong>
                                <small>#{p.id.slice(0, 8).toUpperCase()}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="rr-rating-cell">
                              <FaStar className="rr-star-yellow" /> {p.averageRating.toFixed(1)}
                            </span>
                          </td>
                          <td className="right rr-jobs-col">{p.totalReviews}</td>
                          <td className="right rr-jobs-col">{p.completedJobs}</td>
                          <td className="right">
                            {badge ? (
                              <span className={`rr-perf-badge ${badge.cls}`}>{badge.label}</span>
                            ) : (
                              <span className="rr-muted">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Live Feedback */}
        <div className="rr-feedback-card">
          <div className="rr-feedback-head">
            <div>
              <h3>Customer feedback</h3>
              <p>
                {reviewsTotal} review{reviewsTotal !== 1 ? 's' : ''}
                {selectedServiceName ? ` · ${selectedServiceName}` : ''}
                {lowRatingOnly ? ' · low ratings' : ''}
              </p>
            </div>
            <button
              type="button"
              className={`rr-filter-btn${showFilters ? ' active' : ''}`}
              onClick={() => setShowFilters((v) => !v)}
              aria-label="Toggle filters"
            >
              <FaFilter />
            </button>
          </div>

          {showFilters ? (
            <div className="rr-filter-panel">
              <label>
                Sort
                <select
                  value={reviewSort}
                  onChange={(e) => setReviewSort(e.target.value as ReviewSort)}
                >
                  <option value="recent">Most recent</option>
                  <option value="oldest">Oldest</option>
                  <option value="highest">Highest rated</option>
                  <option value="lowest">Lowest rated</option>
                </select>
              </label>
              <label className="rr-filter-check">
                <input
                  type="checkbox"
                  checked={lowRatingOnly}
                  onChange={(e) => setLowRatingOnly(e.target.checked)}
                />
                Low ratings only (1–2 ★)
              </label>
            </div>
          ) : null}

          <div className="rr-feedback-list">
            {reviewsLoading ? (
              <div className="rr-loading rr-loading-inline">Loading reviews…</div>
            ) : reviews.length === 0 ? (
              <div className="rr-chart-empty rr-chart-empty-sm">
                <FaMagnifyingGlass />
                <p>No reviews match your filters.</p>
              </div>
            ) : (
              reviews.map((r) => {
                const name = clientName(r)
                const colors = colorFor(r.id)
                const prov = providerDisplayName(r)
                const negative = r.rating <= 2
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`rr-review-item rr-review-btn${negative ? ' negative' : ''}`}
                    onClick={() => void openReviewDrawer(r)}
                  >
                    <div className="rr-review-top">
                      <div className="rr-reviewer">
                        {r.client.imageUrl ? (
                          <img src={r.client.imageUrl} alt="" className="rr-client-avatar" />
                        ) : (
                          <span className="rr-initials" style={{ background: colors.bg, color: colors.fg }}>
                            {initials(name)}
                          </span>
                        )}
                        <div>
                          <strong>{name}</strong>
                          <small>{formatRelativeTime(r.createdAt)} · Order {formatAppointmentRef(r)}</small>
                        </div>
                      </div>
                      <StarRow count={r.rating} color={negative ? '#ef4444' : '#FACC15'} />
                    </div>

                    {r.comment ? (
                      <p className="rr-review-text">&ldquo;{r.comment}&rdquo;</p>
                    ) : (
                      <p className="rr-review-text rr-muted">No written comment.</p>
                    )}

                    <div className="rr-tags">
                      <span className={`rr-tag${negative ? ' red' : ''}`}>{reviewServiceName(r)}</span>
                      {r.providerReply ? <span className="rr-tag green">Replied</span> : null}
                    </div>

                    <div className="rr-review-footer">
                      <div className="rr-prov-row">
                        {prov ? (
                          <>
                            {r.provider?.photoUrl ? (
                              <img src={r.provider.photoUrl} alt={prov} />
                            ) : (
                              <span className="rr-unknown-dot"><FaCircleQuestion /></span>
                            )}
                            <span>By {prov}</span>
                          </>
                        ) : (
                          <>
                            <span className="rr-unknown-dot"><FaCircleQuestion /></span>
                            <span>Unassigned provider</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {reviewsTotal > REVIEW_PAGE_SIZE ? (
            <div className="rr-feedback-footer">
              <button type="button" onClick={() => navigate('/company/providers')}>
                Browse team ({stats?.employeeCount ?? 0} providers) →
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Review detail drawer */}
      {selectedReview ? (
        <div className="rr-drawer-overlay" onClick={() => setSelectedReview(null)} role="presentation">
          <aside
            className="rr-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Review details"
          >
            <div className="rr-drawer-head">
              <h3>Review details</h3>
              <button type="button" className="rr-drawer-close" onClick={() => setSelectedReview(null)}>
                <FaXmark />
              </button>
            </div>

            {drawerLoading ? (
              <div className="rr-loading rr-loading-inline">Loading…</div>
            ) : (
              <div className="rr-drawer-body">
                <div className="rr-drawer-rating">
                  <StarRow count={selectedReview.rating} />
                  <span>{selectedReview.rating} / 5</span>
                </div>

                <div className="rr-drawer-section">
                  <h4>Client</h4>
                  <p>{clientName(selectedReview)}</p>
                  <small>{formatRelativeTime(selectedReview.createdAt)}</small>
                </div>

                <div className="rr-drawer-section">
                  <h4>Service</h4>
                  <p>{reviewServiceName(selectedReview)}</p>
                </div>

                <div className="rr-drawer-section">
                  <h4>Employee</h4>
                  <p>{providerDisplayName(selectedReview) ?? 'Not assigned'}</p>
                </div>

                {selectedReview.comment ? (
                  <div className="rr-drawer-section">
                    <h4>Comment</h4>
                    <p className="rr-drawer-comment">{selectedReview.comment}</p>
                  </div>
                ) : null}

                {selectedReview.providerReply ? (
                  <div className="rr-drawer-section rr-drawer-reply">
                    <h4>Provider reply</h4>
                    <p>{selectedReview.providerReply}</p>
                    {selectedReview.repliedAt ? (
                      <small>{formatRelativeTime(selectedReview.repliedAt)}</small>
                    ) : null}
                  </div>
                ) : (
                  <div className="rr-drawer-section">
                    <p className="rr-muted">The assigned provider has not replied yet.</p>
                  </div>
                )}

                {selectedReview.appointment ? (
                  <div className="rr-drawer-section">
                    <h4>Appointment</h4>
                    <p>
                      {new Date(selectedReview.appointment.scheduledDate).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {' · '}
                      {selectedReview.appointment.scheduledTime}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  )
}
