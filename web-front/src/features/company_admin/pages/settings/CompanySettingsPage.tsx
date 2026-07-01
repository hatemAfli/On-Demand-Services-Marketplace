import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import {
  FaBars,
  FaBriefcase,
  FaCalendarCheck,
  FaChartPie,
  FaClock,
  FaCloudArrowUp,
  FaFileInvoiceDollar,
  FaHeadset,
  FaMagnifyingGlass,
  FaPen,
  FaShieldHalved,
  FaUsers,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegBell } from 'react-icons/fa'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyAuditLogEntry,
  CompanySettingsProfile,
} from '../../../../types/company'
import './CompanySettingsPage.css'

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml'

function notifyBrandingUpdated() {
  window.dispatchEvent(new CustomEvent('company-branding-updated'))
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
  }
  return fallback
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
  if (action.includes('BRANDING')) return { icon: <FaPen />, cls: 'purple' }
  if (action.includes('NOTIFICATION')) return { icon: <FaRegBell />, cls: 'blue' }
  if (action.includes('EXPORT')) return { icon: <FaFileInvoiceDollar />, cls: 'green' }
  if (action.includes('PROFILE')) return { icon: <FaPen />, cls: 'blue' }
  if (action.includes('APPOINTMENT')) return { icon: <FaCalendarCheck />, cls: 'orange' }
  if (action.includes('COMPLAINT')) return { icon: <FaHeadset />, cls: 'red' }
  if (action.includes('EMPLOYEE')) return { icon: <FaUsers />, cls: 'blue' }
  if (action.includes('SERVICE')) return { icon: <FaBriefcase />, cls: 'purple' }
  if (action.includes('SCHEDULE')) return { icon: <FaClock />, cls: 'gray' }
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

export function CompanySettingsPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const year = useMemo(() => new Date().getFullYear(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [profile, setProfile] = useState<CompanySettingsProfile | null>(null)
  const [auditLogs, setAuditLogs] = useState<CompanyAuditLogEntry[]>([])

  const [searchQuery, setSearchQuery] = useState('')

  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [allAuditLogs, setAllAuditLogs] = useState<CompanyAuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)

  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await companyApi.getCompanySettings()
      setProfile(data.profile)
      setAuditLogs(data.auditPreview)
    } catch (err) {
      setError(errorMessage(err, 'Could not load company settings.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

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

  const saveBranding = async (payload: { logo?: string | null }) => {
    setSaveState('saving')
    try {
      const updated = await companyApi.updateCompanyBranding(payload)
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      setSaveState('saved')
      notifyBrandingUpdated()
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setSaveState('error')
      setError(errorMessage(err, 'Could not save branding.'))
    }
  }

  const handleLogoFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      setError('Logo must be 2 MB or smaller.')
      return
    }
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowed.includes(file.type)) {
      setError('Only PNG, JPEG, WebP, and SVG images are allowed.')
      return
    }

    setLogoUploading(true)
    setError(null)
    setSaveState('saving')
    try {
      const updated = await companyApi.uploadCompanyLogo(file)
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      setSaveState('saved')
      notifyBrandingUpdated()
      const preview = await companyApi.getCompanyAuditLogs({ take: 5 })
      setAuditLogs(preview.items)
    } catch (err) {
      setSaveState('error')
      setError(errorMessage(err, 'Could not upload logo.'))
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
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
    })
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

      <div ref={containerRef} className="st-body">
        <div className="st-content">
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
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept={LOGO_ACCEPT}
                            className="st-logo-file-input"
                            onChange={(e) => void handleLogoFile(e.target.files?.[0])}
                          />
                          <button
                            type="button"
                            className="st-upload-btn"
                            disabled={logoUploading}
                            onClick={() => logoInputRef.current?.click()}
                          >
                            {logoUploading ? 'Uploading…' : 'Upload New'}
                          </button>
                          <p>Recommended: 400×400px, PNG or SVG. Max 2MB.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
