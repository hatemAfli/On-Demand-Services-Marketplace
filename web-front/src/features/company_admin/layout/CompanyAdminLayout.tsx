import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FaArrowRightFromBracket, FaBars } from 'react-icons/fa6'
import { authService } from '../../../services/auth.service'
import companyApi from '../../../services/companyApi'
import { useAuthStore } from '../../../stores/authStore'
import type { CompanySettingsProfile } from '../../../types/company'
import { CompanyNotificationBell } from '../notifications/CompanyNotificationBell'
import { companyAdminMenuSections } from './companyAdminMenu'
import './CompanyAdminLayout.css'

const DEFAULT_BRAND = '#7621C2'

function initialsFromName(first?: string | null, last?: string | null): string {
  const a = (first?.[0] ?? '').toUpperCase()
  const b = (last?.[0] ?? '').toUpperCase()
  return `${a}${b}`.trim() || '?'
}

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

function resolvePageMeta(pathname: string): {
  label: string
  icon: (typeof companyAdminMenuSections)[0]['items'][0]['icon'] | null
} {
  for (const section of companyAdminMenuSections) {
    for (const item of section.items) {
      if (pathname === item.key || pathname.startsWith(`${item.key}/`)) {
        return { label: item.label, icon: item.icon }
      }
    }
  }
  if (pathname.startsWith('/company/services/given/')) {
    return { label: 'Edit service', icon: null }
  }
  if (pathname.startsWith('/company/complaints/')) {
    return { label: 'Complaint review', icon: null }
  }
  return { label: 'Workspace', icon: null }
}

function resolveSubtitle(pathname: string, companyName: string): string {
  if (pathname === '/company/dashboard') {
    return `Welcome back — here is what is happening at ${companyName} today.`
  }
  if (pathname.startsWith('/company/settings')) {
    return 'Manage profile, branding, and team preferences.'
  }
  return `${companyName} administration workspace.`
}

export function CompanyAdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [profile, setProfile] = useState<CompanySettingsProfile | null>(null)

  const brandColor = DEFAULT_BRAND

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const data = await companyApi.getCompanySettings()
      setProfile(data.profile)
      document.documentElement.style.setProperty('--company-brand', DEFAULT_BRAND)
    } catch {
      setProfile(null)
      document.documentElement.style.setProperty('--company-brand', DEFAULT_BRAND)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const onBrandingUpdated = () => {
      void loadSettings()
    }
    window.addEventListener('company-branding-updated', onBrandingUpdated)
    return () => window.removeEventListener('company-branding-updated', onBrandingUpdated)
  }, [loadSettings])

  useEffect(() => {
    document.documentElement.style.setProperty('--company-brand', brandColor)
  }, [brandColor])

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
  const companyName = profile?.companyName?.trim() || 'Your company'
  const companyLogo = profile?.logo?.trim() || null

  const pageMeta = useMemo(
    () => resolvePageMeta(location.pathname),
    [location.pathname],
  )
  const PageIcon = pageMeta.icon

  const subtitle = useMemo(
    () => resolveSubtitle(location.pathname, companyName),
    [location.pathname, companyName],
  )

  return (
    <div className="company-admin-shell">
      {mobileMenuOpen ? (
        <button
          className="company-admin-overlay"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <aside className={`company-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="company-sidebar-logo-area">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt=""
              className="company-sidebar-logo-img"
            />
          ) : (
            <div
              className="company-sidebar-logo-mark"
              style={{ background: brandColor }}
              aria-hidden
            >
              {settingsLoading ? '…' : companyInitials(companyName)}
            </div>
          )}
          <div className="company-sidebar-brand-text">
            <span className="company-sidebar-logo-text" title={companyName}>
              {settingsLoading ? 'Loading…' : companyName}
            </span>
            <span className="company-sidebar-logo-sub">Company admin</span>
          </div>
        </div>

        <nav className="company-sidebar-nav">
          {companyAdminMenuSections.map((section) => (
            <div key={section.title} className="company-sidebar-section">
              <div className="company-sidebar-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                const active =
                  location.pathname === item.key ||
                  location.pathname.startsWith(`${item.key}/`)
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`company-menu-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      navigate(item.key)
                      setMobileMenuOpen(false)
                    }}
                  >
                    <Icon className="company-menu-item-icon" />
                    <span>{item.label}</span>
                    {item.badge ? (
                      <span className="company-menu-badge">{item.badge}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="company-sidebar-footer">
          <div className="company-profile-card">
            <div
              className="company-profile-avatar"
              style={{ background: `${brandColor}18`, color: brandColor }}
              aria-hidden
            >
              {adminInitials}
            </div>
            <div className="company-profile-text">
              <div className="company-profile-name" title={displayName}>
                {displayName}
              </div>
              <div className="company-profile-role">Company administrator</div>
            </div>
            <button
              type="button"
              className="company-logout-btn"
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
            >
              <FaArrowRightFromBracket />
            </button>
          </div>
        </div>
      </aside>

      <main className="company-main">
        <header className="company-header">
          <div className="company-header-left">
            <button
              type="button"
              className="company-mobile-menu-btn"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <FaBars />
            </button>
            <div className="company-page-head">
              <span className="company-page-kicker">Company admin</span>
              <div className="company-page-title-row">
                {PageIcon ? (
                  <span
                    className="company-page-icon"
                    style={{
                      background: `color-mix(in srgb, ${brandColor} 14%, #fff)`,
                      color: brandColor,
                    }}
                    aria-hidden
                  >
                    <PageIcon />
                  </span>
                ) : null}
                <h1 className="company-header-title">{pageMeta.label}</h1>
              </div>
              <p className="company-header-subtitle">{subtitle}</p>
            </div>
          </div>

          <div className="company-header-right">
            <CompanyNotificationBell brandColor={brandColor} />
          </div>
        </header>

        <section className="company-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
