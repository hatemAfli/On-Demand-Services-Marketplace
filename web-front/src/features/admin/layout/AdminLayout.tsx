import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  FaAnglesLeft,
  FaAnglesRight,
  FaArrowRightFromBracket,
  FaBars,
} from 'react-icons/fa6'
import { useAdminQueueCounts } from '../../../hooks/useAdminQueueCounts'
import { authService } from '../../../services/auth.service'
import { useAuthStore } from '../../../stores/authStore'
import type { AdminOutletContext } from './adminOutletContext'
import {
  buildAdminMenuSections,
  resolveAdminPageMeta,
  resolveAdminSubtitle,
} from './adminMenu'
import './AdminLayout.css'

const PLATFORM_BRAND = '#6366f1'
const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed'
const MOBILE_BREAKPOINT = 1024

function initialsFromName(first?: string | null, last?: string | null): string {
  const a = (first?.[0] ?? '').toUpperCase()
  const b = (last?.[0] ?? '').toUpperCase()
  return `${a}${b}`.trim() || '?'
}

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const toggleSidebar = () => {
    if (window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches) {
      setMobileMenuOpen((open) => !open)
      return
    }
    setSidebarCollapsed((collapsed) => !collapsed)
  }

  const counts = useAdminQueueCounts()

  const menuSections = useMemo(
    () =>
      buildAdminMenuSections({
        pendingVerificationTotal: counts.pendingVerificationTotal,
        pendingProviderVerifications: counts.pendingProviderVerifications,
        pendingCompanyVerifications: counts.pendingCompanyVerifications,
        openReclamations: counts.openReclamations,
      }),
    [
      counts.pendingVerificationTotal,
      counts.pendingProviderVerifications,
      counts.pendingCompanyVerifications,
      counts.openReclamations,
    ],
  )

  const logout = async () => {
    await authService.logout()
    setUser(null)
    navigate('/login', { replace: true })
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email ?? 'Admin'

  const adminInitials = initialsFromName(user?.firstName, user?.lastName)

  const pageMeta = useMemo(
    () => resolveAdminPageMeta(location.pathname),
    [location.pathname],
  )
  const PageIcon = pageMeta.icon

  const subtitle = useMemo(
    () => resolveAdminSubtitle(location.pathname),
    [location.pathname],
  )

  return (
    <div
      className="admin-shell"
      style={{ ['--admin-brand' as string]: PLATFORM_BRAND }}
    >
      {mobileMenuOpen ? (
        <button
          className="admin-overlay"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside
        className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''} ${
          sidebarCollapsed ? 'collapsed' : ''
        }`}
      >
        <div className="admin-sidebar-logo-area">
          <div
            className="admin-sidebar-logo-mark"
            style={{ background: PLATFORM_BRAND }}
            aria-hidden
          >
            SP
          </div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-logo-text">ServeMe</span>
            <span className="admin-sidebar-logo-sub">Platform admin</span>
          </div>
          <button
            type="button"
            className="admin-sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {sidebarCollapsed ? <FaAnglesRight /> : <FaAnglesLeft />}
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {menuSections.map((section) => (
            <div key={section.title} className="admin-sidebar-section">
              <div className="admin-sidebar-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                const active =
                  location.pathname === item.key ||
                  location.pathname.startsWith(`${item.key}/`)
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`admin-menu-item ${active ? 'active' : ''}`}
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => {
                      navigate(item.key)
                      setMobileMenuOpen(false)
                    }}
                  >
                    <span className="admin-menu-item-icon-wrap">
                      <Icon className="admin-menu-item-icon" />
                      {sidebarCollapsed && item.badge && item.badge > 0 ? (
                        <span className="admin-menu-badge-dot" aria-hidden />
                      ) : null}
                    </span>
                    <span className="admin-menu-item-label">{item.label}</span>
                    {!sidebarCollapsed && item.badge && item.badge > 0 ? (
                      <span className="admin-menu-badge">{item.badge}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-card">
            <div
              className="admin-profile-avatar"
              style={{
                background: `${PLATFORM_BRAND}18`,
                color: PLATFORM_BRAND,
              }}
              aria-hidden
            >
              {adminInitials}
            </div>
            <div className="admin-profile-text">
              <div className="admin-profile-name" title={displayName}>
                {displayName}
              </div>
              <div className="admin-profile-role">Platform administrator</div>
            </div>
            <button
              type="button"
              className="admin-logout-btn"
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
            >
              <FaArrowRightFromBracket />
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={toggleSidebar}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen || !sidebarCollapsed}
            >
              <FaBars />
            </button>
            <div className="admin-page-head">
              <span className="admin-page-kicker">Platform admin</span>
              <div className="admin-page-title-row">
                {PageIcon ? (
                  <span
                    className="admin-page-icon"
                    style={{
                      background: `color-mix(in srgb, ${PLATFORM_BRAND} 14%, #fff)`,
                      color: PLATFORM_BRAND,
                    }}
                    aria-hidden
                  >
                    <PageIcon />
                  </span>
                ) : null}
                <h1 className="admin-header-title">{pageMeta.label}</h1>
              </div>
              <p className="admin-header-subtitle">{subtitle}</p>
            </div>
          </div>
        </header>

        <section className="admin-content">
          <Outlet context={counts satisfies AdminOutletContext} />
        </section>
      </main>
    </div>
  )
}
