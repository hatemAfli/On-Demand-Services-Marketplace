import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FaBars, FaBell, FaChevronDown, FaLayerGroup, FaLocationDot } from 'react-icons/fa6'
import { authService } from '../../../services/auth.service'
import { useAuthStore } from '../../../stores/authStore'
import { companyAdminMenuSections } from './companyAdminMenu'
import './CompanyAdminLayout.css'

export function CompanyAdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const logout = async () => {
    await authService.logout()
    setUser(null)
    navigate('/login', { replace: true })
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email ?? 'John Stone'

  const subtitle = useMemo(() => {
    if (location.pathname === '/company/dashboard') return 'Welcome back, here is what is happening today.'
    return 'Company administration workspace.'
  }, [location.pathname])

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
          <div className="company-sidebar-logo-icon">
            <FaLayerGroup />
          </div>
          <span className="company-sidebar-logo-text">HireWise</span>
        </div>

        <div className="company-branch-switcher-wrap">
          <button className="company-branch-switcher">
            <div className="company-branch-left">
              <div className="company-branch-icon">
                <FaLocationDot />
              </div>
              <div>
                <div className="company-branch-kicker">Current Branch</div>
                <div className="company-branch-name">Dubai HQ</div>
              </div>
            </div>
            <FaChevronDown className="company-branch-chevron" />
          </button>
        </div>

        <nav className="company-sidebar-nav">
          {companyAdminMenuSections.map((section) => (
            <div key={section.title} className="company-sidebar-section">
              <div className="company-sidebar-section-title">{section.title}</div>
              {section.items.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.key
                return (
                  <button
                    key={item.key}
                    className={`company-menu-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      navigate(item.key)
                      setMobileMenuOpen(false)
                    }}
                  >
                    <Icon className="company-menu-item-icon" />
                    <span>{item.label}</span>
                    {item.badge ? <span className="company-menu-badge">{item.badge}</span> : null}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="company-sidebar-footer">
          <div className="company-profile-row">
            <img
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg"
              className="company-profile-avatar"
              alt="Profile"
            />
            <div className="company-profile-text">
              <div className="company-profile-name">{displayName}</div>
              <div className="company-profile-role">Operations Manager</div>
            </div>
            <button className="company-logout-btn" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="company-main">
        <header className="company-header">
          <div className="company-header-left">
            <button className="company-mobile-menu-btn" onClick={() => setMobileMenuOpen((v) => !v)}>
              <FaBars />
            </button>
            <div>
              <h1 className="company-header-title">Dashboard Overview</h1>
              <p className="company-header-subtitle">{subtitle}</p>
            </div>
          </div>

          <div className="company-header-right">
            <div className="company-search-wrap">
              <input
                type="text"
                placeholder="Search orders, providers..."
                className="company-search-input"
              />
            </div>
            <button className="company-quick-action-btn">
              Quick Action <FaChevronDown />
            </button>
            <button className="company-notification-btn">
              <FaBell />
              <span className="company-notification-dot" />
            </button>
          </div>
        </header>

        <section className="company-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
