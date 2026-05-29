import { useCallback, useMemo, useRef, useState } from 'react'
import {
  FaBars,
  FaBuilding,
  FaChartPie,
  FaChevronDown,
  FaCloudArrowUp,
  FaEllipsisVertical,
  FaFileInvoiceDollar,
  FaFilter,
  FaMagnifyingGlass,
  FaMapLocationDot,
  FaPen,
  FaPenToSquare,
  FaPlus,
  FaShieldHalved,
  FaStore,
  FaTrash,
  FaUsers,
  FaUserShield,
  FaWarehouse,
} from 'react-icons/fa6'
import { FaRegBell, FaRegBuilding, FaUserPlus } from 'react-icons/fa'
import './CompanySettingsPage.css'

type SectionId = 'general' | 'locations' | 'roles' | 'notifications'
const SECTION_IDS: SectionId[] = ['general', 'locations', 'roles', 'notifications']

const USERS = [
  { id: 1, name: 'Jeannette Prosacco', email: 'Arnoldo.Bayer51@yahoo.com', status: 'Active',    role: 'Admin',   avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg', checked: false, alt: false },
  { id: 2, name: 'Janie Funk',         email: 'janie.funk@yahoo.com',       status: 'Suspended', role: 'User',    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg', checked: true,  alt: true  },
  { id: 3, name: 'Tonya Keeling',      email: 'tonya45@gmail.com',          status: 'Invited',   role: 'Admin',   avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg', checked: false, alt: false },
  { id: 4, name: 'Ramiro Homenick',    email: 'ramiro.h@hotmail.com',       status: 'Active',    role: 'Analyst', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-4.jpg', checked: true,  alt: true  },
  { id: 5, name: 'Dominick West',      email: 'dominick.w@hotmail.com',     status: 'Suspended', role: 'User',    avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg', checked: false, alt: false },
]

const STATUS_CLS: Record<string, string> = {
  Active:    'green',
  Suspended: 'orange',
  Invited:   'gray',
}

const BRANCHES = [
  { name: 'Dubai HQ',        sub: 'Main Office',       city: 'Dubai, UAE',     status: 'Operational', providers: '12 Active', iconCls: 'blue',   Icon: FaBuilding },
  { name: 'Abu Dhabi Branch',sub: 'Satellite Office',  city: 'Abu Dhabi, UAE', status: 'Operational', providers: '5 Active',  iconCls: 'orange', Icon: FaStore    },
  { name: 'Riyadh Hub',      sub: 'Regional Center',   city: 'Riyadh, KSA',    status: 'Coming Soon', providers: '—',         iconCls: 'gray',   Icon: FaWarehouse },
]

const BRANCH_STATUS_CLS: Record<string, string> = {
  Operational:  'green',
  'Coming Soon': 'yellow',
}

const AUDIT_LOGS = [
  { icon: <FaPen />,         iconCls: 'blue',  text: <><strong>John Stone</strong> updated company address.</>,                    time: 'Today at 10:23 AM • IP: 192.168.1.42',  id: '#LOG-8392' },
  { icon: <FaUserPlus />,    iconCls: 'green', text: <><strong>Sarah Connor</strong> invited a new provider "Mike Ross".</>,       time: 'Yesterday at 4:15 PM • IP: 192.168.1.18', id: '#LOG-8391' },
  { icon: <FaShieldHalved />,iconCls: 'red',   text: <><strong>System</strong> blocked suspicious login attempt.</>,               time: 'Oct 24 at 2:00 AM • IP: 45.32.11.90',    id: '#LOG-8390' },
]

const NOTIF_ITEMS = [
  { id: 'toggle1', label: 'New Order Alerts',          sub: 'Email & Push when a new booking is made.',        defaultOn: true  },
  { id: 'toggle2', label: 'Provider Status Updates',   sub: 'Notify when providers go online/offline.',        defaultOn: false },
  { id: 'toggle3', label: 'Weekly Performance Report', sub: 'Send summary PDF every Monday.',                  defaultOn: true  },
  { id: 'toggle4', label: 'System Announcements',      sub: 'Product updates and maintenance alerts.',         defaultOn: true  },
]

export function CompanySettingsPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<SectionId>('general')
  const year = useMemo(() => new Date().getFullYear(), [])

  const scrollToSection = useCallback((id: SectionId) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    let current: SectionId = 'general'
    for (const id of SECTION_IDS) {
      const section = document.getElementById(id)
      if (!section) continue
      if (container.scrollTop >= section.offsetTop - 150) current = id
    }
    setActiveTab(current)
  }, [])

  return (
    <div className="st-root">
      {/* Header */}
      <header className="st-header">
        <div className="st-header-left">
          <button className="st-mobile-menu"><FaBars /></button>
          <div>
            <div className="st-header-title-row">
              <h1>Settings &amp; Company Profile</h1>
              <span className="st-autosave-badge">
                <span className="st-pulse-dot" />
                Auto-save Active
              </span>
            </div>
            <p className="st-header-sub">Manage company details, branding, and system preferences.</p>
          </div>
        </div>

        <div className="st-header-actions">
          <div className="st-search-wrap">
            <FaMagnifyingGlass className="st-search-icon" />
            <input type="text" placeholder="Search settings..." className="st-search-input" />
          </div>
          <button className="st-bell-btn">
            <FaRegBell />
            <span className="st-bell-dot" />
          </button>
          <div className="st-divider" />
          <button className="st-publish-btn">
            <FaCloudArrowUp />
            <span>Publish Changes</span>
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="st-body"
      >
        <div className="st-content">

          {/* Sticky tab bar */}
          <div className="st-tabs-bar">
            <nav className="st-tabs-nav">
              {([
                { id: 'general',       icon: <FaRegBuilding />,    label: 'General & Branding' },
                { id: 'locations',     icon: <FaMapLocationDot />, label: 'Locations' },
                { id: 'roles',         icon: <FaShieldHalved />,   label: 'Roles' },
                { id: 'notifications', icon: <FaRegBell />,        label: 'Notifications' },
              ] as { id: SectionId; icon: React.ReactNode; label: string }[]).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => scrollToSection(t.id)}
                  className={`st-tab${activeTab === t.id ? ' active' : ''}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ── Section 1: General & Branding ───────────────────── */}
          <section id="general" className="st-section">
            <div className="st-section-grid">
              {/* Left: Company Info + Data Export */}
              <div className="st-col-left">
                {/* Company Info */}
                <div className="st-card">
                  <h2>Company Information</h2>
                  <p>Update your company details and public profile information.</p>

                  <div className="st-form-grid">
                    <div className="st-field">
                      <label>Company Name</label>
                      <input type="text" defaultValue="HireWise Solutions LLC" className="st-input" />
                    </div>
                    <div className="st-field">
                      <label>Tax Registration Number (TRN)</label>
                      <input type="text" defaultValue="AE1234567890" className="st-input" />
                    </div>
                    <div className="st-field">
                      <label>Business Email</label>
                      <input type="email" defaultValue="contact@hirewise.com" className="st-input" />
                    </div>
                    <div className="st-field">
                      <label>Phone Number</label>
                      <div className="st-phone-wrap">
                        <span className="st-phone-prefix">+971</span>
                        <input type="tel" defaultValue="50 123 4567" className="st-input st-phone-input" />
                      </div>
                    </div>
                    <div className="st-field st-col-span-2">
                      <label>Headquarters Address</label>
                      <input type="text" defaultValue="Office 402, Business Bay Tower, Dubai, UAE" className="st-input" />
                    </div>
                    <div className="st-field st-col-span-2">
                      <label>About Company</label>
                      <textarea
                        rows={3}
                        defaultValue="Leading provider of on-demand professional services in the GCC region, specializing in home maintenance and corporate facility management."
                        className="st-input st-textarea"
                      />
                    </div>
                  </div>
                </div>

                {/* Data Export */}
                <div className="st-card">
                  <div className="st-card-head-row">
                    <div>
                      <h2>Data Export</h2>
                      <p>Download your company data for external processing.</p>
                    </div>
                    <button className="st-link-btn">View History</button>
                  </div>
                  <div className="st-export-row">
                    {[
                      { Icon: FaUsers,              iconCls: 'blue',   label: 'Export Providers', fmt: 'CSV format' },
                      { Icon: FaFileInvoiceDollar,  iconCls: 'green',  label: 'Export Orders',    fmt: 'XLSX format' },
                      { Icon: FaChartPie,           iconCls: 'purple', label: 'Financial Report', fmt: 'PDF format' },
                    ].map(({ Icon, iconCls, label, fmt }) => (
                      <button key={label} className="st-export-btn">
                        <div className={`st-export-icon ${iconCls}`}><Icon /></div>
                        <div>
                          <div className="st-export-label">{label}</div>
                          <div className="st-export-fmt">{fmt}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Branding */}
              <div className="st-col-right">
                <div className="st-card">
                  <h2>Branding</h2>
                  <p>Customize your dashboard appearance.</p>

                  {/* Logo */}
                  <div className="st-brand-section">
                    <label className="st-label">Company Logo</label>
                    <div className="st-logo-row">
                      <div className="st-logo-preview">
                        <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg" alt="Logo" />
                      </div>
                      <div className="st-logo-actions">
                        <button className="st-upload-btn">Upload New</button>
                        <p>Recommended: 400×400px, PNG or SVG. Max 2MB.</p>
                      </div>
                    </div>
                  </div>

                  {/* Brand Color */}
                  <div className="st-brand-section">
                    <label className="st-label">Brand Color</label>
                    <div className="st-color-row">
                      <div className="st-color-swatch" />
                      <input type="text" defaultValue="#7621C2" className="st-input st-color-input" />
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="st-brand-section">
                    <label className="st-label">Dashboard Theme</label>
                    <div className="st-theme-grid">
                      <button className="st-theme-btn active">
                        <div className="st-theme-preview light" />
                        <span>Light</span>
                      </button>
                      <button className="st-theme-btn">
                        <div className="st-theme-preview dark" />
                        <span>Dark</span>
                      </button>
                      <button className="st-theme-btn">
                        <div className="st-theme-preview system" />
                        <span>System</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 2: Locations ─────────────────────────────── */}
          <section id="locations" className="st-section">
            <div className="st-section-head">
              <div>
                <h2>Locations &amp; Service Areas</h2>
                <p>Manage your branches and operational zones across cities.</p>
              </div>
              <button className="st-add-btn">
                <FaPlus className="st-add-icon" />
                <span>Add New Branch</span>
              </button>
            </div>

            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th>City / Region</th>
                    <th>Status</th>
                    <th>Providers</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {BRANCHES.map((b) => (
                    <tr key={b.name}>
                      <td>
                        <div className="st-branch-cell">
                          <div className={`st-branch-icon ${b.iconCls}`}><b.Icon /></div>
                          <div>
                            <strong>{b.name}</strong>
                            <small>{b.sub}</small>
                          </div>
                        </div>
                      </td>
                      <td>{b.city}</td>
                      <td><span className={`st-status-badge ${BRANCH_STATUS_CLS[b.status]}`}>{b.status}</span></td>
                      <td>{b.providers}</td>
                      <td className="right">
                        <button className="st-tbl-action edit"><FaPenToSquare /></button>
                        <button className="st-tbl-action del"><FaTrash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Section 3: Roles & Permissions ───────────────────── */}
          <section id="roles" className="st-section">
            <div className="st-roles-grid">
              {/* Role editor */}
              <div className="st-card st-role-editor">
                <h2>User Roles</h2>
                <p>Manage access levels for your team.</p>

                <div className="st-field" style={{ marginBottom: '16px' }}>
                  <label className="st-label">Select Role to Edit</label>
                  <div className="st-select-wrap">
                    <select className="st-select">
                      <option>Owner</option>
                      <option>Admin</option>
                      <option>Manager</option>
                      <option>Support Agent</option>
                      <option>Viewer</option>
                    </select>
                    <FaChevronDown className="st-select-arrow" />
                  </div>
                </div>

                <div className="st-inherit-box">
                  <input id="inherit" type="checkbox" className="st-checkbox" />
                  <label htmlFor="inherit">
                    Inherit permissions and status settings from the organizational unit above.
                  </label>
                </div>

                <div className="st-perm-group">
                  <h3>Quick Settings</h3>
                  {[
                    { id: 'p1', label: 'Can manage billing & subscription', checked: false },
                    { id: 'p2', label: 'Can invite new users',               checked: true  },
                    { id: 'p3', label: 'Can view audit logs',                checked: true  },
                  ].map((p) => (
                    <div key={p.id} className="st-perm-row">
                      <input id={p.id} type="checkbox" defaultChecked={p.checked} className="st-checkbox" />
                      <label htmlFor={p.id}>{p.label}</label>
                    </div>
                  ))}
                </div>

                <button className="st-create-role-btn">Create New Role</button>
              </div>

              {/* Users table */}
              <div className="st-card st-users-card">
                <div className="st-users-toolbar">
                  <div className="st-search-wrap sm">
                    <FaMagnifyingGlass className="st-search-icon" />
                    <input type="text" placeholder="Search users..." className="st-search-input" />
                  </div>
                  <div className="st-toolbar-right">
                    <span className="st-selected-count">2 selected</span>
                    <button className="st-toolbar-btn blue"><FaUserShield /> Set Permissions</button>
                    <button className="st-toolbar-btn gray"><FaFilter /> Filter</button>
                  </div>
                </div>

                <div className="st-users-scroll">
                  <table className="st-table users">
                    <thead>
                      <tr>
                        <th className="chk"><input type="checkbox" className="st-checkbox" /></th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Role</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {USERS.map((u) => (
                        <tr key={u.id} className={u.alt ? 'alt' : ''}>
                          <td className="chk"><input type="checkbox" defaultChecked={u.checked} className="st-checkbox" /></td>
                          <td>
                            <div className="st-user-cell">
                              <img src={u.avatar} alt={u.name} />
                              <span>{u.name}</span>
                            </div>
                          </td>
                          <td className="st-email-col">{u.email}</td>
                          <td><span className={`st-status-badge ${STATUS_CLS[u.status]}`}>{u.status}</span></td>
                          <td>{u.role}</td>
                          <td className="st-action-col">
                            <button className="st-dots-btn"><FaEllipsisVertical /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="st-pagination">
                  <span>Showing 1-5 of 120 users</span>
                  <div>
                    <button className="st-page-btn" disabled>Previous</button>
                    <button className="st-page-btn">Next</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 4: Notifications ─────────────────────────── */}
          <section id="notifications" className="st-section">
            <h2>Notification Preferences</h2>
            <p>Control what updates your team receives.</p>

            <div className="st-notif-list">
              {NOTIF_ITEMS.map((n) => (
                <div key={n.id} className="st-notif-row">
                  <div>
                    <div className="st-notif-label">{n.label}</div>
                    <div className="st-notif-sub">{n.sub}</div>
                  </div>
                  <div className="st-toggle-wrap">
                    <input
                      type="checkbox"
                      id={n.id}
                      className="st-toggle-checkbox"
                      defaultChecked={n.defaultOn}
                    />
                    <label htmlFor={n.id} className="st-toggle-label" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 5: Audit Logs ────────────────────────────── */}
          <section id="audit" className="st-card">
            <div className="st-card-head-row">
              <div>
                <h2>Audit Logs</h2>
                <p>Track changes and sensitive actions.</p>
              </div>
              <button className="st-link-btn">Download CSV</button>
            </div>

            <div className="st-audit-list">
              {AUDIT_LOGS.map((l) => (
                <div key={l.id} className="st-audit-row">
                  <div className={`st-audit-icon ${l.iconCls}`}>{l.icon}</div>
                  <div className="st-audit-body">
                    <p>{l.text}</p>
                    <small>{l.time}</small>
                  </div>
                  <span className="st-audit-id">{l.id}</span>
                </div>
              ))}
            </div>

            <button className="st-audit-view-all">View all logs</button>
          </section>

          {/* Footer */}
          <footer className="st-footer">
            <span>© {year} HireWise Inc. All rights reserved.</span>
            <div>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Help Center</a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
