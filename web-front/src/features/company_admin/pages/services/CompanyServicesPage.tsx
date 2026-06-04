import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FaBriefcase,
  FaMagnifyingGlass,
  FaStar,
  FaXmark,
} from 'react-icons/fa6'
import { companyApi } from '../../../../services/companyApi'
import type {
  CategoryFilter,
  CompanyServiceDetail,
  CompanyServiceGroup,
} from '../../../../types/company'
import './CompanyServicesPage.css'

/* ── helpers ─────────────────────────────────────────────── */
function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function fmtPrice(n: number) {
  return n.toFixed(0)
}

const CATEGORY_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]
function categoryColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length]
}

/* ── main component ───────────────────────────────────────── */
export function CompanyServicesPage() {
  const navigate = useNavigate()

  const [services, setServices] = useState<CompanyServiceGroup[]>([])
  const [categories, setCategories] = useState<CategoryFilter[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerServiceId, setDrawerServiceId] = useState<string | null>(null)
  const [drawerDetail, setDrawerDetail] = useState<CompanyServiceDetail | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  /* debounce search */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  /* fetch services */
  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const params: { search?: string; categoryId?: string; active?: boolean } = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (selectedCategoryId !== 'all') params.categoryId = selectedCategoryId
      if (activeFilter === 'active') params.active = true
      if (activeFilter === 'inactive') params.active = false
      const data = await companyApi.getCompanyServices(params)
      setServices(data)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCategoryId, activeFilter])

  useEffect(() => { void fetchServices() }, [fetchServices])

  /* fetch categories once */
  useEffect(() => {
    companyApi.getCompanyCategories().then(setCategories).catch(() => {})
  }, [])

  /* stats */
  const stats = useMemo(() => {
    const totalServices = services.length
    const activeOfferings = services.reduce((s, g) => s + g.activeProviders, 0)
    const totalJobs = services.reduce((s, g) => s + g.totalCompletedJobs, 0)
    const totalReviews = services.reduce((s, g) => s + g.totalReviews, 0)
    const avgRating =
      totalReviews > 0
        ? services.reduce((s, g) => s + g.averageRating * g.totalReviews, 0) / totalReviews
        : 0
    return { totalServices, activeOfferings, avgRating, totalJobs }
  }, [services])

  /* open drawer */
  const openDrawer = useCallback((serviceId: string) => {
    setDrawerOpen(true)
    setDrawerServiceId(serviceId)
    setDrawerDetail(null)
    setDrawerLoading(true)
    companyApi
      .getCompanyServiceDetail(serviceId)
      .then((data) => { setDrawerDetail(data) })
      .finally(() => setDrawerLoading(false))
  }, [])

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerServiceId(null)
    setDrawerDetail(null)
  }

  /* optimistic toggle for a provider row inside the drawer */
  const handleToggleProvider = useCallback(
    async (givenServiceId: string, current: boolean) => {
      // optimistic
      setDrawerDetail((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          givenServices: prev.givenServices.map((gs) =>
            gs.id === givenServiceId ? { ...gs, active: !current } : gs,
          ),
        }
      })
      try {
        await companyApi.toggleGivenServiceActive(givenServiceId, !current)
        // also refresh service list card
        void fetchServices()
      } catch {
        // revert on error
        setDrawerDetail((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            givenServices: prev.givenServices.map((gs) =>
              gs.id === givenServiceId ? { ...gs, active: current } : gs,
            ),
          }
        })
      }
    },
    [fetchServices],
  )

  return (
    <div className="cs-root">
      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="cs-stats-grid">
        <StatCard
          label="Total services"
          value={loading ? '—' : String(stats.totalServices)}
          sub="unique services"
          color="purple"
        />
        <StatCard
          label="Active offerings"
          value={loading ? '—' : String(stats.activeOfferings)}
          sub="provider slots active"
          color="green"
        />
        <StatCard
          label="Average rating"
          value={loading ? '—' : stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
          sub="weighted by reviews"
          color="yellow"
        />
        <StatCard
          label="Total jobs done"
          value={loading ? '—' : String(stats.totalJobs)}
          sub="completed appointments"
          color="blue"
        />
      </div>

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="cs2-toolbar">
        <div className="cs2-toolbar-left">
          <div className="cs2-search-wrap">
            <FaMagnifyingGlass className="cs2-search-icon" />
            <input
              type="text"
              placeholder="Search services…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="cs2-select"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.categoryName} ({c.serviceCount})
              </option>
            ))}
          </select>

          <div className="cs2-toggle-group">
            {(['all', 'active', 'inactive'] as const).map((v) => (
              <button
                key={v}
                className={`cs2-toggle-btn${activeFilter === v ? ' active' : ''}`}
                onClick={() => setActiveFilter(v)}
              >
                {v === 'all' ? 'All' : v === 'active' ? 'Active only' : 'Inactive only'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="cs2-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cs2-card-skeleton" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="cs2-empty">
          <FaBriefcase />
          <p>No services found</p>
          <small>Services appear here once providers are added to your company.</small>
        </div>
      ) : (
        <div className="cs2-grid">
          {services.map((svc) => (
            <ServiceCard
              key={svc.serviceId}
              group={svc}
              onClick={() => openDrawer(svc.serviceId)}
              isOpen={drawerServiceId === svc.serviceId && drawerOpen}
            />
          ))}
        </div>
      )}

      {/* ── Drawer ───────────────────────────────────────────── */}
      {drawerOpen && (
        <>
          <div className="cs2-backdrop" onClick={closeDrawer} />
          <aside className="cs2-drawer">
            <div className="cs2-drawer-header">
              <div className="cs2-drawer-title-group">
                <h2>{drawerDetail?.serviceName ?? '…'}</h2>
                {drawerDetail && (
                  <span className="cs2-cat-badge" style={{ background: '#6366f120', color: '#6366f1' }}>
                    {drawerDetail.categoryName}
                  </span>
                )}
              </div>
              <button className="cs2-close-btn" onClick={closeDrawer}>
                <FaXmark />
              </button>
            </div>

            <div className="cs2-drawer-body">
              {drawerLoading ? (
                <DrawerSkeleton />
              ) : drawerDetail ? (
                <>
                  {/* provider list */}
                  <div className="cs2-provider-section-title">
                    Providers offering this service ({drawerDetail.givenServices.length})
                  </div>
                  {drawerDetail.givenServices.length === 0 ? (
                    <p className="cs2-drawer-empty">No providers yet.</p>
                  ) : (
                    <div className="cs2-provider-list">
                      {drawerDetail.givenServices.map((gs) => {
                        const name = `${gs.provider.user.firstName} ${gs.provider.user.lastName}`
                        const color = categoryColor(gs.provider.id)
                        return (
                          <div key={gs.id} className="cs2-provider-row">
                            <div className="cs2-prov-left">
                              {gs.provider.photoUrl ? (
                                <img
                                  src={gs.provider.photoUrl}
                                  alt={name}
                                  className="cs2-prov-avatar"
                                />
                              ) : (
                                <div
                                  className="cs2-prov-avatar-ini"
                                  style={{ background: color }}
                                >
                                  {initials(name)}
                                </div>
                              )}
                              <div>
                                <div className="cs2-prov-name">{name}</div>
                                <div className="cs2-prov-email">{gs.provider.user.email}</div>
                              </div>
                            </div>

                            <div className="cs2-prov-right">
                              <StatusBadge status={gs.provider.user.status} />
                              <div className="cs2-prov-price">
                                {fmtPrice(gs.price)} TND
                                {gs.pricingType === 'HOURLY' ? '/hr' : ' fixed'}
                              </div>
                              <div className="cs2-prov-rating">
                                <FaStar className="cs2-star" />
                                {Number(gs.averageRating) > 0 ? Number(gs.averageRating).toFixed(1) : '—'}
                              </div>

                              {/* active toggle */}
                              <button
                                role="switch"
                                aria-checked={gs.active}
                                className={`cs2-toggle${gs.active ? ' on' : ''}`}
                                onClick={() => void handleToggleProvider(gs.id, gs.active)}
                                title={gs.active ? 'Deactivate' : 'Activate'}
                              >
                                <span className="cs2-toggle-thumb" />
                              </button>

                              <button
                                className="cs2-edit-btn"
                                onClick={() =>
                                  navigate(`/company/services/given/${gs.id}`)
                                }
                              >
                                Edit →
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

/* ── sub-components ───────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: 'purple' | 'green' | 'yellow' | 'blue'
}) {
  return (
    <article className={`cs-stat-card cs-hover-${color}`}>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
        <span className="cs-sub-text">{sub}</span>
      </div>
      <div className={`cs-stat-icon ${color}`}>
        <FaBriefcase />
      </div>
    </article>
  )
}

function ServiceCard({
  group: g,
  onClick,
  isOpen,
}: {
  group: CompanyServiceGroup
  onClick: () => void
  isOpen: boolean
}) {
  const color = categoryColor(g.categoryId)

  const activeBadgeClass =
    g.activeProviders === g.totalProviders
      ? 'cs2-active-badge green'
      : g.activeProviders === 0
      ? 'cs2-active-badge red'
      : 'cs2-active-badge amber'
  const activeBadgeText =
    g.activeProviders === g.totalProviders
      ? 'All active'
      : g.activeProviders === 0
      ? 'All inactive'
      : `${g.activeProviders} of ${g.totalProviders} active`

  const slots = Array.from({ length: Math.min(g.totalProviders, 3) })

  return (
    <div
      className={`cs2-card${isOpen ? ' selected' : ''}`}
      onClick={onClick}
    >
      {/* image area — only rendered when the service has its own photo */}
      {g.coverImage && (
        <div className="cs2-card-img-wrap">
          <img src={g.coverImage} alt={g.serviceName} className="cs2-card-img" />
          <span className="cs2-overlay-badge left" style={{ background: color }}>
            {g.categoryName}
          </span>
          <span className="cs2-overlay-badge right">
            {g.totalProviders} provider{g.totalProviders !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* body */}
      <div className="cs2-card-body">
        <div className="cs2-card-name">{g.serviceName}</div>
        <div className="cs2-card-category">{g.categoryName}</div>

        <div className="cs2-card-stats">
          <span>⭐ {Number(g.averageRating) > 0 ? Number(g.averageRating).toFixed(1) : '—'}</span>
          <span>📋 {g.totalCompletedJobs} jobs</span>
          <span>💰 {fmtPrice(Number(g.averagePrice))} TND</span>
        </div>

        <div className="cs2-card-footer">
          {/* mini avatar stack */}
          <div className="cs2-avatar-stack">
            {slots.map((_, i) => (
              <div
                key={i}
                className="cs2-avatar-ini"
                style={{ background: CATEGORY_COLORS[(i + 2) % CATEGORY_COLORS.length] }}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
            {g.totalProviders > 3 && (
              <div className="cs2-avatar-ini cs2-avatar-extra">
                +{g.totalProviders - 3}
              </div>
            )}
          </div>

          <span className={activeBadgeClass}>{activeBadgeText}</span>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'Active', cls: 'cs2-status-badge green' },
    PENDING: { label: 'Pending', cls: 'cs2-status-badge amber' },
    SUSPENDED: { label: 'Suspended', cls: 'cs2-status-badge red' },
  }
  const s = map[status] ?? { label: status, cls: 'cs2-status-badge gray' }
  return <span className={s.cls}>{s.label}</span>
}

function DrawerSkeleton() {
  return (
    <div className="cs2-skeleton-wrap">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="cs2-skeleton-row">
          <div className="cs2-skel cs2-skel-avatar" />
          <div style={{ flex: 1 }}>
            <div className="cs2-skel cs2-skel-line" style={{ width: '60%' }} />
            <div className="cs2-skel cs2-skel-line" style={{ width: '40%', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
