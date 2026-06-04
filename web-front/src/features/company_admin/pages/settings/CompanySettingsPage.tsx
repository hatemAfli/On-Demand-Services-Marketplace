import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import {
  FaBars,
  FaBuilding,
  FaChartPie,
  FaChevronDown,
  FaCloudArrowUp,
  FaEllipsisVertical,
  FaFileInvoiceDollar,
  FaMagnifyingGlass,
  FaMapLocationDot,
  FaPen,
  FaPenToSquare,
  FaPlus,
  FaShieldHalved,
  FaStore,
  FaTrash,
  FaUsers,
  FaWarehouse,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegBell, FaRegBuilding } from 'react-icons/fa'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyAuditLogEntry,
  CompanyBranch,
  CompanyBranchStatus,
  CompanyNotificationPreferences,
  CompanySettingsProfile,
  CompanyTeamMember,
  DashboardTheme,
  UpsertCompanyBranchPayload,
} from '../../../../types/company'
import './CompanySettingsPage.css'

type SectionId = 'general' | 'locations' | 'roles' | 'notifications'
const SECTION_IDS: SectionId[] = ['general', 'locations', 'roles', 'notifications']

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'green',
  PENDING: 'gray',
  SUSPENDED: 'orange',
  BANNED: 'orange',
}

const BRANCH_STATUS_CLS: Record<string, string> = {
  OPERATIONAL: 'green',
  COMING_SOON: 'yellow',
  INACTIVE: 'gray',
}

const BRANCH_ICONS = [FaBuilding, FaStore, FaWarehouse]
const BRANCH_ICON_CLS = ['blue', 'orange', 'gray']

const NOTIF_ITEMS: Array<{
  key: keyof CompanyNotificationPreferences
  label: string
  sub: string
}> = [
  { key: 'newOrderAlerts', label: 'New Order Alerts', sub: 'Email & push when a new booking is made.' },
  { key: 'providerStatusUpdates', label: 'Provider Status Updates', sub: 'Notify when providers go online/offline.' },
  { key: 'weeklyReport', label: 'Weekly Performance Report', sub: 'Send summary every Monday.' },
  { key: 'systemAnnouncements', label: 'System Announcements', sub: 'Product updates and maintenance alerts.' },
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

function accountStatusLabel(status: string): string {
  if (status === 'ACTIVE') return 'Active'
  if (status === 'PENDING') return 'Pending'
  if (status === 'SUSPENDED') return 'Suspended'
  return status
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()

  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today at ${time}`
  if (isYesterday) return `Yesterday at ${time}`
  return `${d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} at ${time}`
}

function auditIcon(action: string) {
  if (action.includes('BRANCH')) return { icon: <FaMapLocationDot />, cls: 'blue' }
  if (action.includes('BRANDING')) return { icon: <FaPen />, cls: 'purple' }
  if (action.includes('NOTIFICATION')) return { icon: <FaRegBell />, cls: 'blue' }
  if (action.includes('EXPORT')) return { icon: <FaFileInvoiceDollar />, cls: 'green' }
  if (action.includes('PROFILE')) return { icon: <FaPen />, cls: 'blue' }
  return { icon: <FaShieldHalved />, cls: 'red' }
}

async function downloadExport(
  type: 'providers' | 'orders' | 'summary' | 'audit-logs',
  filename: string,
) {
  const res = await companyApi.downloadCompanyExport(type)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const EMPTY_BRANCH_FORM: UpsertCompanyBranchPayload = {
  name: '',
  subtitle: '',
  city: '',
  address: '',
  status: 'OPERATIONAL',
}

export function CompanySettingsPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeTab, setActiveTab] = useState<SectionId>('general')
  const year = useMemo(() => new Date().getFullYear(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [profile, setProfile] = useState<CompanySettingsProfile | null>(null)
  const [branches, setBranches] = useState<CompanyBranch[]>([])
  const [notifications, setNotifications] = useState<CompanyNotificationPreferences | null>(null)
  const [team, setTeam] = useState<CompanyTeamMember[]>([])
  const [auditLogs, setAuditLogs] = useState<CompanyAuditLogEntry[]>([])
  const [multiAdminSupported, setMultiAdminSupported] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<CompanyBranch | null>(null)
  const [branchForm, setBranchForm] = useState<UpsertCompanyBranchPayload>(EMPTY_BRANCH_FORM)
  const [branchSaving, setBranchSaving] = useState(false)

  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [allAuditLogs, setAllAuditLogs] = useState<CompanyAuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)

  const [logoModalOpen, setLogoModalOpen] = useState(false)
  const [logoUrlInput, setLogoUrlInput] = useState('')

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await companyApi.getCompanySettings()
      setProfile(data.profile)
      setBranches(data.branches)
      setNotifications(data.notifications)
      setTeam(data.team.members)
      setMultiAdminSupported(data.team.multiAdminSupported)
      setAuditLogs(data.auditPreview)
      setLogoUrlInput(data.profile.logo ?? '')
    } catch (err) {
      setError(errorMessage(err, 'Could not load company settings.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (!profile?.brandColor) return
    document.documentElement.style.setProperty('--company-brand', profile.brandColor)
  }, [profile?.brandColor])

  const persistProfile = useCallback(async (payload: Partial<CompanySettingsProfile>) => {
    setSaveState('saving')
    try {
      const updated = await companyApi.updateCompanyProfile(payload)
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
      setSaveState('saved')
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setSaveState('error')
      setError(errorMessage(err, 'Could not save profile.'))
    }
  }, [])

  const scheduleProfileSave = useCallback(
    (next: CompanySettingsProfile) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void persistProfile({
          companyName: next.companyName,
          taxId: next.taxId,
          email: next.email,
          phone: next.phone,
          city: next.city,
          address: next.address,
          about: next.about,
        })
      }, 900)
    },
    [persistProfile],
  )

  const updateProfileField = <K extends keyof CompanySettingsProfile>(
    key: K,
    value: CompanySettingsProfile[K],
  ) => {
    setProfile((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      scheduleProfileSave(next)
      return next
    })
  }

  const saveBranding = async (payload: {
    logo?: string | null
    brandColor?: string
    dashboardTheme?: DashboardTheme
  }) => {
    setSaveState('saving')
    try {
      const updated = await companyApi.updateCompanyBranding(payload)
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      setSaveState('saved')
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setSaveState('error')
      setError(errorMessage(err, 'Could not save branding.'))
    }
  }

  const handlePublish = async () => {
    if (!profile) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await persistProfile({
      companyName: profile.companyName,
      taxId: profile.taxId,
      email: profile.email,
      phone: profile.phone,
      city: profile.city,
      address: profile.address,
      about: profile.about,
    })
    await saveBranding({
      logo: profile.logo,
      brandColor: profile.brandColor,
      dashboardTheme: profile.dashboardTheme,
    })
  }

  const toggleNotification = async (key: keyof CompanyNotificationPreferences) => {
    if (!notifications) return
    const next = !notifications[key]
    setNotifications({ ...notifications, [key]: next })
    try {
      const updated = await companyApi.updateCompanyNotifications({ [key]: next })
      setNotifications(updated)
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setNotifications({ ...notifications, [key]: !next })
      setError(errorMessage(err, 'Could not update notifications.'))
    }
  }

  const openBranchModal = (branch?: CompanyBranch) => {
    if (branch) {
      setEditingBranch(branch)
      setBranchForm({
        name: branch.name,
        subtitle: branch.subtitle ?? '',
        city: branch.city,
        address: branch.address ?? '',
        status: branch.status,
      })
    } else {
      setEditingBranch(null)
      setBranchForm({ ...EMPTY_BRANCH_FORM })
    }
    setBranchModalOpen(true)
  }

  const saveBranch = async () => {
    setBranchSaving(true)
    try {
      if (editingBranch) {
        const updated = await companyApi.updateCompanyBranch(editingBranch.id, branchForm)
        setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      } else {
        const created = await companyApi.createCompanyBranch(branchForm)
        setBranches((prev) => [...prev, created])
      }
      setBranchModalOpen(false)
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setError(errorMessage(err, 'Could not save branch.'))
    } finally {
      setBranchSaving(false)
    }
  }

  const deleteBranch = async (branch: CompanyBranch) => {
    if (!window.confirm(`Delete branch "${branch.name}"?`)) return
    try {
      await companyApi.deleteCompanyBranch(branch.id)
      setBranches((prev) => prev.filter((b) => b.id !== branch.id))
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setError(errorMessage(err, 'Could not delete branch.'))
    }
  }

  const openAllAuditLogs = async () => {
    setAuditModalOpen(true)
    try {
      const data = await companyApi.getCompanyAuditLogs({ take: 50 })
      setAllAuditLogs(data.items)
      setAuditTotal(data.total)
    } catch (err) {
      setError(errorMessage(err, 'Could not load audit logs.'))
    }
  }

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

  const filteredTeam = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return team
    return team.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    )
  }, [team, userSearch])

  const sectionVisible = useCallback(
    (keywords: string[]) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return keywords.some((k) => k.toLowerCase().includes(q))
    },
    [searchQuery],
  )

  if (loading && !profile) {
    return (
      <div className="st-root">
        <div className="st-loading">Loading settings…</div>
      </div>
    )
  }

  return (
    <div className="st-root">
      <header className="st-header">
        <div className="st-header-left">
          <button type="button" className="st-mobile-menu"><FaBars /></button>
          <div>
            <div className="st-header-title-row">
              <h1>Settings &amp; Company Profile</h1>
              <span className={`st-autosave-badge${saveState === 'error' ? ' error' : ''}`}>
                <span className="st-pulse-dot" />
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'error'
                    ? 'Save failed'
                    : 'Auto-save active'}
              </span>
            </div>
            <p className="st-header-sub">Manage company details, branding, and system preferences.</p>
          </div>
        </div>

        <div className="st-header-actions">
          <div className="st-search-wrap">
            <FaMagnifyingGlass className="st-search-icon" />
            <input
              type="text"
              placeholder="Search settings..."
              className="st-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="button" className="st-publish-btn" onClick={() => void handlePublish()}>
            <FaCloudArrowUp />
            <span>Publish Changes</span>
          </button>
        </div>
      </header>

      {error ? <div className="st-error-banner">{error}</div> : null}

      <div ref={containerRef} onScroll={handleScroll} className="st-body">
        <div className="st-content">
          <div className="st-tabs-bar">
            <nav className="st-tabs-nav">
              {([
                { id: 'general', icon: <FaRegBuilding />, label: 'General & Branding' },
                { id: 'locations', icon: <FaMapLocationDot />, label: 'Locations' },
                { id: 'roles', icon: <FaShieldHalved />, label: 'Roles' },
                { id: 'notifications', icon: <FaRegBell />, label: 'Notifications' },
              ] as { id: SectionId; icon: React.ReactNode; label: string }[]).map((t) => (
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

          {sectionVisible(['general', 'branding', 'company', 'export']) ? (
            <section id="general" className="st-section">
              <div className="st-section-grid">
                <div className="st-col-left">
                  <div className="st-card">
                    <h2>Company Information</h2>
                    <p>Update your company details and public profile information.</p>
                    {profile ? (
                      <div className="st-form-grid">
                        <div className="st-field">
                          <label>Company Name</label>
                          <input
                            type="text"
                            className="st-input"
                            value={profile.companyName}
                            onChange={(e) => updateProfileField('companyName', e.target.value)}
                          />
                        </div>
                        <div className="st-field">
                          <label>Tax Registration Number (TRN)</label>
                          <input
                            type="text"
                            className="st-input"
                            value={profile.taxId}
                            onChange={(e) => updateProfileField('taxId', e.target.value)}
                          />
                        </div>
                        <div className="st-field">
                          <label>Business Email</label>
                          <input
                            type="email"
                            className="st-input"
                            value={profile.email}
                            onChange={(e) => updateProfileField('email', e.target.value)}
                          />
                        </div>
                        <div className="st-field">
                          <label>Phone Number</label>
                          <input
                            type="tel"
                            className="st-input"
                            value={profile.phone}
                            onChange={(e) => updateProfileField('phone', e.target.value)}
                            placeholder="+216 XX XXX XXX"
                          />
                        </div>
                        <div className="st-field">
                          <label>Primary City</label>
                          <input
                            type="text"
                            className="st-input"
                            value={profile.city}
                            onChange={(e) => updateProfileField('city', e.target.value)}
                          />
                        </div>
                        <div className="st-field">
                          <label>Headquarters Address</label>
                          <input
                            type="text"
                            className="st-input"
                            value={profile.address}
                            onChange={(e) => updateProfileField('address', e.target.value)}
                          />
                        </div>
                        <div className="st-field st-col-span-2">
                          <label>About Company</label>
                          <textarea
                            rows={3}
                            className="st-input st-textarea"
                            value={profile.about}
                            onChange={(e) => updateProfileField('about', e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="st-card">
                    <div className="st-card-head-row">
                      <div>
                        <h2>Data Export</h2>
                        <p>Download your company data for external processing.</p>
                      </div>
                      <button type="button" className="st-link-btn" onClick={() => void openAllAuditLogs()}>
                        View History
                      </button>
                    </div>
                    <div className="st-export-row">
                      {[
                        { type: 'providers' as const, Icon: FaUsers, iconCls: 'blue', label: 'Export Providers', fmt: 'CSV format', file: 'company-providers.csv' },
                        { type: 'orders' as const, Icon: FaFileInvoiceDollar, iconCls: 'green', label: 'Export Orders', fmt: 'CSV format', file: 'company-orders.csv' },
                        { type: 'summary' as const, Icon: FaChartPie, iconCls: 'purple', label: 'Financial Report', fmt: 'CSV summary', file: 'company-summary.csv' },
                      ].map(({ type, Icon, iconCls, label, fmt, file }) => (
                        <button
                          key={label}
                          type="button"
                          className="st-export-btn"
                          onClick={() => void downloadExport(type, file).catch((err) => setError(errorMessage(err, 'Export failed.')))}
                        >
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

                <div className="st-col-right">
                  <div className="st-card">
                    <h2>Branding</h2>
                    <p>Customize your dashboard appearance.</p>

                    <div className="st-brand-section">
                      <label className="st-label">Company Logo</label>
                      <div className="st-logo-row">
                        <div className="st-logo-preview">
                          {profile?.logo ? (
                            <img src={profile.logo} alt="Company logo" />
                          ) : (
                            <span className="st-logo-placeholder">{profile?.companyName?.[0] ?? 'C'}</span>
                          )}
                        </div>
                        <div className="st-logo-actions">
                          <button type="button" className="st-upload-btn" onClick={() => setLogoModalOpen(true)}>
                            Upload New
                          </button>
                          <p>Recommended: 400×400px, PNG or SVG. Max 2MB.</p>
                        </div>
                      </div>
                    </div>

                    <div className="st-brand-section">
                      <label className="st-label">Brand Color</label>
                      <div className="st-color-row">
                        <div
                          className="st-color-swatch"
                          style={{ background: profile?.brandColor ?? '#7621C2' }}
                        />
                        <input
                          type="text"
                          className="st-input st-color-input"
                          value={profile?.brandColor ?? '#7621C2'}
                          onChange={(e) => updateProfileField('brandColor', e.target.value)}
                          onBlur={() => void saveBranding({ brandColor: profile?.brandColor })}
                        />
                      </div>
                    </div>

                    <div className="st-brand-section">
                      <label className="st-label">Dashboard Theme</label>
                      <div className="st-theme-grid">
                        {([
                          { theme: 'LIGHT' as DashboardTheme, label: 'Light', preview: 'light' },
                          { theme: 'DARK' as DashboardTheme, label: 'Dark', preview: 'dark' },
                          { theme: 'SYSTEM' as DashboardTheme, label: 'System', preview: 'system' },
                        ]).map((t) => (
                          <button
                            key={t.theme}
                            type="button"
                            className={`st-theme-btn${profile?.dashboardTheme === t.theme ? ' active' : ''}`}
                            onClick={() => {
                              updateProfileField('dashboardTheme', t.theme)
                              void saveBranding({ dashboardTheme: t.theme })
                            }}
                          >
                            <div className={`st-theme-preview ${t.preview}`} />
                            <span>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {sectionVisible(['locations', 'branch', 'service areas']) ? (
            <section id="locations" className="st-section">
              <div className="st-section-head">
                <div>
                  <h2>Locations &amp; Service Areas</h2>
                  <p>Manage your branches and operational zones across cities.</p>
                </div>
                <button type="button" className="st-add-btn" onClick={() => openBranchModal()}>
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
                    {branches.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="st-empty-cell">No branches yet.</td>
                      </tr>
                    ) : (
                      branches.map((b, i) => {
                        const Icon = BRANCH_ICONS[i % BRANCH_ICONS.length]
                        const iconCls = BRANCH_ICON_CLS[i % BRANCH_ICON_CLS.length]
                        return (
                          <tr key={b.id}>
                            <td>
                              <div className="st-branch-cell">
                                <div className={`st-branch-icon ${iconCls}`}><Icon /></div>
                                <div>
                                  <strong>{b.name}</strong>
                                  <small>{b.subtitle ?? 'Branch'}</small>
                                </div>
                              </div>
                            </td>
                            <td>{b.city}</td>
                            <td>
                              <span className={`st-status-badge ${BRANCH_STATUS_CLS[b.status] ?? 'gray'}`}>
                                {b.statusLabel}
                              </span>
                            </td>
                            <td>{b.activeProviders > 0 ? `${b.activeProviders} active` : '—'}</td>
                            <td className="right">
                              <button type="button" className="st-tbl-action edit" onClick={() => openBranchModal(b)}>
                                <FaPenToSquare />
                              </button>
                              <button type="button" className="st-tbl-action del" onClick={() => void deleteBranch(b)}>
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {sectionVisible(['roles', 'users', 'permissions', 'team']) ? (
            <section id="roles" className="st-section">
              <div className="st-roles-grid">
                <div className="st-card st-role-editor">
                  <h2>User Roles</h2>
                  <p>Manage access levels for your team.</p>

                  {!multiAdminSupported ? (
                    <div className="st-info-banner">
                      Your account is the company owner. Multi-admin seats will be available in a future release.
                    </div>
                  ) : null}

                  <div className="st-field" style={{ marginBottom: '16px' }}>
                    <label className="st-label">Select Role to Edit</label>
                    <div className="st-select-wrap">
                      <select className="st-select" defaultValue="Owner" disabled>
                        <option>Owner</option>
                      </select>
                      <FaChevronDown className="st-select-arrow" />
                    </div>
                  </div>

                  <div className="st-perm-group">
                    <h3>Owner permissions</h3>
                    {[
                      'Can manage billing & subscription',
                      'Can invite new users',
                      'Can view audit logs',
                      'Can export company data',
                    ].map((label) => (
                      <div key={label} className="st-perm-row">
                        <input type="checkbox" defaultChecked className="st-checkbox" disabled />
                        <label>{label}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="st-card st-users-card">
                  <div className="st-users-toolbar">
                    <div className="st-search-wrap sm">
                      <FaMagnifyingGlass className="st-search-icon" />
                      <input
                        type="text"
                        placeholder="Search users..."
                        className="st-search-input"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="st-users-scroll">
                    <table className="st-table users">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Role</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeam.map((u, idx) => (
                          <tr key={u.id} className={idx % 2 === 1 ? 'alt' : ''}>
                            <td>
                              <div className="st-user-cell">
                                <span className="st-user-initials">{u.name[0]?.toUpperCase() ?? 'U'}</span>
                                <span>{u.name}</span>
                              </div>
                            </td>
                            <td className="st-email-col">{u.email}</td>
                            <td>
                              <span className={`st-status-badge ${STATUS_CLS[u.status] ?? 'gray'}`}>
                                {accountStatusLabel(u.status)}
                              </span>
                            </td>
                            <td>{u.role}</td>
                            <td className="st-action-col">
                              <button type="button" className="st-dots-btn" disabled aria-label="Actions">
                                <FaEllipsisVertical />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="st-pagination">
                    <span>Showing {filteredTeam.length} admin user{filteredTeam.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {sectionVisible(['notifications', 'alerts']) ? (
            <section id="notifications" className="st-section">
              <h2>Notification Preferences</h2>
              <p>Control what updates your team receives.</p>

              <div className="st-notif-list">
                {notifications
                  ? NOTIF_ITEMS.map((n) => (
                      <div key={n.key} className="st-notif-row">
                        <div>
                          <div className="st-notif-label">{n.label}</div>
                          <div className="st-notif-sub">{n.sub}</div>
                        </div>
                        <div className="st-toggle-wrap">
                          <input
                            type="checkbox"
                            id={n.key}
                            className="st-toggle-checkbox"
                            checked={notifications[n.key]}
                            onChange={() => void toggleNotification(n.key)}
                          />
                          <label htmlFor={n.key} className="st-toggle-label" />
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </section>
          ) : null}

          <section id="audit" className="st-card">
            <div className="st-card-head-row">
              <div>
                <h2>Audit Logs</h2>
                <p>Track changes and sensitive actions.</p>
              </div>
              <button
                type="button"
                className="st-link-btn"
                onClick={() => void downloadExport('audit-logs', 'company-audit-logs.csv').catch((err) => setError(errorMessage(err, 'Export failed.')))}
              >
                Download CSV
              </button>
            </div>

            <div className="st-audit-list">
              {auditLogs.length === 0 ? (
                <div className="st-empty-cell">No activity recorded yet.</div>
              ) : (
                auditLogs.map((l) => {
                  const meta = auditIcon(l.action)
                  return (
                    <div key={l.id} className="st-audit-row">
                      <div className={`st-audit-icon ${meta.cls}`}>{meta.icon}</div>
                      <div className="st-audit-body">
                        <p><strong>{l.actorName}</strong> — {l.summary}</p>
                        <small>
                          {formatAuditTime(l.createdAt)}
                          {l.ipAddress ? ` • IP: ${l.ipAddress}` : ''}
                        </small>
                      </div>
                      <span className="st-audit-id">{l.displayId}</span>
                    </div>
                  )
                })
              )}
            </div>

            <button type="button" className="st-audit-view-all" onClick={() => void openAllAuditLogs()}>
              View all logs
            </button>
          </section>

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

      {branchModalOpen ? (
        <div className="st-modal-overlay" onClick={() => setBranchModalOpen(false)} role="presentation">
          <div className="st-modal" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-head">
              <h3>{editingBranch ? 'Edit Branch' : 'Add Branch'}</h3>
              <button type="button" className="st-modal-close" onClick={() => setBranchModalOpen(false)}>
                <FaXmark />
              </button>
            </div>
            <div className="st-modal-body">
              <div className="st-field">
                <label>Branch name</label>
                <input
                  className="st-input"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                />
              </div>
              <div className="st-field">
                <label>Subtitle</label>
                <input
                  className="st-input"
                  value={branchForm.subtitle ?? ''}
                  onChange={(e) => setBranchForm({ ...branchForm, subtitle: e.target.value })}
                  placeholder="Main Office"
                />
              </div>
              <div className="st-field">
                <label>City</label>
                <input
                  className="st-input"
                  value={branchForm.city}
                  onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                />
              </div>
              <div className="st-field">
                <label>Address</label>
                <input
                  className="st-input"
                  value={branchForm.address ?? ''}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                />
              </div>
              <div className="st-field">
                <label>Status</label>
                <select
                  className="st-select"
                  value={branchForm.status ?? 'OPERATIONAL'}
                  onChange={(e) =>
                    setBranchForm({
                      ...branchForm,
                      status: e.target.value as CompanyBranchStatus,
                    })
                  }
                >
                  <option value="OPERATIONAL">Operational</option>
                  <option value="COMING_SOON">Coming Soon</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
            <div className="st-modal-foot">
              <button type="button" className="st-link-btn" onClick={() => setBranchModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="st-publish-btn"
                disabled={branchSaving || !branchForm.name.trim() || !branchForm.city.trim()}
                onClick={() => void saveBranch()}
              >
                {branchSaving ? 'Saving…' : 'Save branch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {logoModalOpen ? (
        <div className="st-modal-overlay" onClick={() => setLogoModalOpen(false)} role="presentation">
          <div className="st-modal sm" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-head">
              <h3>Update company logo</h3>
              <button type="button" className="st-modal-close" onClick={() => setLogoModalOpen(false)}>
                <FaXmark />
              </button>
            </div>
            <div className="st-modal-body">
              <div className="st-field">
                <label>Logo URL</label>
                <input
                  className="st-input"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="st-modal-foot">
              <button type="button" className="st-link-btn" onClick={() => setLogoModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="st-publish-btn"
                onClick={() => {
                  updateProfileField('logo', logoUrlInput.trim() || null)
                  void saveBranding({ logo: logoUrlInput.trim() || null })
                  setLogoModalOpen(false)
                }}
              >
                Save logo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {auditModalOpen ? (
        <div className="st-modal-overlay" onClick={() => setAuditModalOpen(false)} role="presentation">
          <div className="st-modal lg" onClick={(e) => e.stopPropagation()}>
            <div className="st-modal-head">
              <h3>Audit logs ({auditTotal})</h3>
              <button type="button" className="st-modal-close" onClick={() => setAuditModalOpen(false)}>
                <FaXmark />
              </button>
            </div>
            <div className="st-modal-body st-audit-modal-body">
              {allAuditLogs.map((l) => {
                const meta = auditIcon(l.action)
                return (
                  <div key={l.id} className="st-audit-row">
                    <div className={`st-audit-icon ${meta.cls}`}>{meta.icon}</div>
                    <div className="st-audit-body">
                      <p><strong>{l.actorName}</strong> — {l.summary}</p>
                      <small>
                        {formatAuditTime(l.createdAt)}
                        {l.ipAddress ? ` • IP: ${l.ipAddress}` : ''}
                      </small>
                    </div>
                    <span className="st-audit-id">{l.displayId}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
