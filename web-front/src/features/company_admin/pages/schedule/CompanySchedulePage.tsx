import { useState, useEffect, useRef } from 'react'
import {
  FaBell,
  FaBolt,
  FaBroom,
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaLocationArrow,
  FaMagnifyingGlass,
  FaPlus,
  FaScrewdriverWrench,
  FaSpa,
  FaTriangleExclamation,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegCalendarCheck, FaRegClock } from 'react-icons/fa'
import './CompanySchedulePage.css'

type ProviderRow = {
  id: string
  name: string
  role: string
  avatar: string
  status: 'online' | 'busy' | 'off' | 'conflict'
  loadPct: number
  offDuty?: boolean
  conflict?: boolean
}

const PROVIDERS: ProviderRow[] = [
  { id: 'david',  name: 'David Chen',      role: 'Cleaning Specialist', avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg', status: 'online',   loadPct: 40 },
  { id: 'sarah',  name: 'Sarah Mitchell',  role: 'Senior Cleaner',      avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg', status: 'online',   loadPct: 95 },
  { id: 'emma',   name: 'Emma Wilson',     role: 'AC Technician',       avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-6.jpg', status: 'busy',     loadPct: 75 },
  { id: 'elena',  name: 'Elena Rodriguez', role: 'Massage Therapist',   avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-5.jpg', status: 'off',      loadPct: 0,  offDuty: true },
  { id: 'ahmed',  name: 'Ahmed Khan',      role: 'Upholstery Expert',   avatar: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-8.jpg', status: 'conflict', loadPct: 100, conflict: true },
]

const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']

export function CompanySchedulePage() {
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false)
  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const providerScrollRef = useRef<HTMLDivElement>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pEl = providerScrollRef.current
    const gEl = gridScrollRef.current
    if (!pEl || !gEl) return

    const syncP = () => { gEl.scrollTop = pEl.scrollTop }
    const syncG = () => { pEl.scrollTop = gEl.scrollTop }

    pEl.addEventListener('scroll', syncP)
    gEl.addEventListener('scroll', syncG)
    return () => {
      pEl.removeEventListener('scroll', syncP)
      gEl.removeEventListener('scroll', syncG)
    }
  }, [])

  const openOrder = (id: string) => { setSelectedOrderId(id); setOrderDrawerOpen(true) }
  const closeOrder = () => { setOrderDrawerOpen(false); setTimeout(() => setSelectedOrderId(null), 300) }
  const openConflict = (e?: React.MouseEvent) => { e?.stopPropagation(); setConflictModalOpen(true) }

  return (
    <div className="sc-root">
      {/* Top info row */}
      <div className="sc-top-grid">
        {/* Capacity overview */}
        <div className="sc-capacity-card">
          <div className="sc-capacity-head">
            <div>
              <h3>Branch Capacity Overview</h3>
              <p>Current utilization vs. target capacity per service category</p>
            </div>
            <div className="sc-legend">
              <span><em className="dot green" />Optimal</span>
              <span><em className="dot yellow" />High</span>
              <span><em className="dot red" />Critical</span>
            </div>
          </div>

          <div className="sc-bars-grid">
            {[
              { icon: <FaBroom />, label: 'Cleaning',    pct: 92, color: 'red',    sub: '24/26 Providers Active', peak: 'Peak: 2pm – 4pm' },
              { icon: <FaScrewdriverWrench />, label: 'Maintenance', pct: 65, color: 'green',  sub: '8/12 Providers Active',  peak: 'Peak: 10am – 12pm' },
              { icon: <FaSpa />, label: 'Beauty & Spa', pct: 78, color: 'yellow', sub: '14/18 Providers Active', peak: 'Peak: 5pm – 8pm' },
            ].map((b) => (
              <div key={b.label} className="sc-bar-item">
                <div className="sc-bar-top">
                  <span className="sc-bar-label">{b.icon} {b.label}</span>
                  <strong className={`sc-bar-val ${b.color}`}>{b.pct}%</strong>
                </div>
                <div className="sc-bar-track">
                  <div className={`sc-bar-fill ${b.color}`} style={{ width: `${b.pct}%` }} />
                </div>
                <div className="sc-bar-sub">
                  <span>{b.sub}</span>
                  <span>{b.peak}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="sc-alerts-card">
          <div className="sc-alerts-head">
            <h3><FaBell className="sc-bell" /> Alerts &amp; Conflicts</h3>
            <span className="sc-critical-badge">3 Critical</span>
          </div>
          <div className="sc-alerts-list">
            <div className="sc-alert red" onClick={() => openConflict()}>
              <span className="sc-alert-icon red"><FaTriangleExclamation /></span>
              <div>
                <strong>Double Booking Detected</strong>
                <p>Ahmed Khan has 2 orders at 2:00 PM today.</p>
                <button onClick={openConflict}>Resolve Conflict</button>
              </div>
            </div>
            <div className="sc-alert yellow">
              <span className="sc-alert-icon yellow"><FaRegClock /></span>
              <div>
                <strong>Overtime Warning</strong>
                <p>Sarah Mitchell approaching 10h shift limit.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule block */}
      <div className="sc-schedule-card">
        {/* Toolbar */}
        <div className="sc-schedule-toolbar">
          <div className="sc-toolbar-left">
            <div className="sc-filter-search">
              <FaMagnifyingGlass className="sc-search-icon" />
              <input type="text" placeholder="Filter providers..." />
            </div>
            <div className="sc-vdivider" />
            <button className="sc-filter-btn"><FaFilter className="sc-filter-icon" /> Skills</button>
            <button className="sc-filter-btn"><FaLocationArrow className="sc-filter-icon" /> Zone</button>
          </div>
          <div className="sc-legend-row">
            <span><em className="sq purple" />Scheduled</span>
            <span><em className="sq green" />Completed</span>
            <span><em className="sq gray" />Break/Off</span>
          </div>
        </div>

        {/* Gantt */}
        <div className="sc-gantt">
          {/* Provider column */}
          <div className="sc-provider-col">
            <div className="sc-col-header">Providers (12)</div>
            <div className="sc-provider-list" ref={providerScrollRef}>
              {PROVIDERS.map((p) => (
                <div
                  key={p.id}
                  className={`sc-provider-row${p.conflict ? ' conflict' : ''}${p.offDuty ? ' off' : ''}`}
                  onClick={p.conflict ? () => openConflict() : undefined}
                >
                  <div className="sc-prov-avatar-wrap">
                    <img src={p.avatar} alt={p.name} className={p.offDuty ? 'grayscale' : ''} />
                    <span className={`sc-status-dot ${p.status}`} />
                    {p.conflict ? <span className="sc-conflict-badge">!</span> : null}
                  </div>
                  <div className="sc-prov-info">
                    <strong className={p.offDuty ? 'muted' : ''}>{p.name}</strong>
                    <small className={p.offDuty ? 'muted' : ''}>{p.role}</small>
                    {p.offDuty ? (
                      <span className="sc-off-badge">Off Duty</span>
                    ) : (
                      <div className="sc-load-bar-wrap">
                        <div className="sc-load-track">
                          <div
                            className={`sc-load-fill ${p.loadPct >= 90 ? 'red' : p.loadPct >= 70 ? 'yellow' : 'green'}`}
                            style={{ width: `${p.loadPct}%` }}
                          />
                        </div>
                        <span className={`sc-load-label ${p.loadPct >= 90 ? 'red' : ''}`}>
                          {p.conflict ? 'Conflict' : `${p.loadPct}% Load`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="sc-timeline-col">
            {/* Hour header */}
            <div className="sc-time-header">
              {HOURS.map((h) => <div key={h} className="sc-time-cell">{h}</div>)}
            </div>

            {/* Rows */}
            <div className="sc-grid-rows" ref={gridScrollRef}>
              {/* Grid lines */}
              <div className="sc-grid-lines" />

              {/* Current time */}
              <div className="sc-now-line" style={{ left: '31.8%' }}>
                <span>11:30</span>
              </div>

              {/* Row: David */}
              <div className="sc-grid-row">
                <Block left="9.09%"  width="13.63%" color="purple" label="Deep Cleaning"   time="09:00 – 10:30" onClick={() => openOrder('ORD-2489')} />
                <Block left="45.45%" width="18.18%" color="green"  label="Studio Moving"    time="13:00 – 15:00" onClick={() => openOrder('ORD-2492')} />
              </div>

              {/* Row: Sarah */}
              <div className="sc-grid-row">
                <Block left="0%"    width="22.72%" color="gray"   label="Office Clean"      time="08:00 – 10:30" done />
                <Block left="25%"   width="22.72%" color="blue"   label="Villa Deep Clean"  time="10:45 – 13:15" active />
                <Block left="50%"   width="13.63%" color="purple" label="Carpet Clean"      time="13:30 – 15:00" />
                <Block left="65.9%" width="18.18%" color="purple" label="Sofa Shampoo"      time="15:15 – 17:15" />
              </div>

              {/* Row: Emma */}
              <div className="sc-grid-row">
                <Block left="13.6%"  width="9.09%"  color="purple" label="AC Check"          time="09:30 – 10:30" />
                <BreakBlock left="36.36%" width="9.09%" />
                <Block left="54.54%" width="27.27%" color="purple" label="AC Installation"   time="14:00 – 17:00" />
              </div>

              {/* Row: Elena (off duty) */}
              <div className="sc-grid-row off">
                <span className="sc-off-label">Off Duty – Scheduled Leave</span>
              </div>

              {/* Row: Ahmed (conflict) */}
              <div className="sc-grid-row">
                <Block left="9.09%"  width="18.18%" color="purple" label="Curtain Install"   time="09:00 – 11:00" />
                <div className="sc-conflict-zone" style={{ left: '54.54%', width: '15.9%' }} />
                <Block left="54.54%" width="13.63%" color="red"    label="Sofa Repair"       time="14:00 – 15:30" conflict onClick={() => openConflict()} topHalf />
                <Block left="56.81%" width="13.63%" color="red"    label="Chair Fix"         time="14:15 – 15:45" conflict onClick={() => openConflict()} bottomHalf />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="sc-footer">
        <span>© 2024 HireWise Inc. All rights reserved.</span>
        <div>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
      </footer>

      {/* Conflict Modal */}
      {conflictModalOpen ? (
        <div className="sc-modal-overlay" onClick={() => setConflictModalOpen(false)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sc-modal-header">
              <div className="sc-modal-title">
                <span className="sc-bolt-icon"><FaBolt /></span>
                <div>
                  <h3>Schedule Conflict Detected</h3>
                  <p>Ahmed Khan has overlapping bookings</p>
                </div>
              </div>
              <button onClick={() => setConflictModalOpen(false)}><FaXmark /></button>
            </div>

            <div className="sc-modal-body">
              <div className="sc-conflict-compare">
                <div className="sc-conflict-booking">
                  <small>Booking A</small>
                  <strong>Sofa Repair</strong>
                  <span>14:00 – 15:30</span>
                </div>
                <FaXmark className="sc-conflict-x" />
                <div className="sc-conflict-booking">
                  <small>Booking B</small>
                  <strong>Chair Fix</strong>
                  <span>14:15 – 15:45</span>
                </div>
              </div>

              <div className="sc-ai-section">
                <p className="sc-ai-label">AI Recommendation</p>
                <div className="sc-ai-card">
                  <div className="sc-ai-top">
                    <div className="sc-ai-badges">
                      <span className="sc-best-badge">Best Option</span>
                      <strong>Reassign "Chair Fix" to David Chen</strong>
                    </div>
                    <span className="sc-ai-check"><FaRegCalendarCheck /></span>
                  </div>
                  <p>David is available in the same zone (Business Bay) and has the required "Upholstery" skill tag.</p>
                  <div className="sc-ai-provider">
                    <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg" alt="David Chen" />
                    <div>
                      <strong>David Chen</strong>
                      <small>4.9 ★ Rating • <span className="avail">Available</span></small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sc-modal-footer">
              <button className="sc-btn-ghost" onClick={() => setConflictModalOpen(false)}>Ignore</button>
              <button className="sc-btn-primary">Apply Reassignment</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Order Drawer */}
      {orderDrawerOpen ? (
        <>
          <div className="sc-drawer-backdrop" onClick={closeOrder} />
          <aside className="sc-drawer">
            <div className="sc-drawer-header">
              <h2>Order Details</h2>
              <button onClick={closeOrder}><FaXmark /></button>
            </div>

            <div className="sc-drawer-body">
              <div className="sc-order-hero">
                <div>
                  <small>Upcoming Service</small>
                  <h3>{selectedOrderId === 'ORD-2492' ? 'Studio Moving' : 'Deep Cleaning'}</h3>
                  <div className="sc-order-meta">
                    <span><FaRegClock /> 09:00 – 10:30</span>
                    <span><FaChevronRight className="sc-pin" /> Dubai Marina</span>
                  </div>
                </div>
                <span className="sc-order-badge">{selectedOrderId ?? '#ORD-2489'}</span>
              </div>

              <div className="sc-order-customer">
                <p>Customer</p>
                <div className="sc-cust-row">
                  <img src="https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-7.jpg" alt="Lisa Wong" />
                  <div>
                    <strong>Lisa Wong</strong>
                    <span>+971 50 123 4567</span>
                  </div>
                  <button className="sc-contact-btn">Contact</button>
                </div>
              </div>
            </div>

            <div className="sc-drawer-footer">
              <button className="sc-drawer-btn-outline">Reschedule</button>
              <button className="sc-drawer-btn-danger">Cancel Order</button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────────── */
function Block({
  left, width, color, label, time, done, active, conflict, topHalf, bottomHalf, onClick,
}: {
  left: string; width: string; color: string; label: string; time: string
  done?: boolean; active?: boolean; conflict?: boolean; topHalf?: boolean; bottomHalf?: boolean
  onClick?: () => void
}) {
  const cls = [
    'sc-block',
    `sc-block-${color}`,
    done ? 'done' : '',
    active ? 'active' : '',
    conflict ? 'conflict' : '',
    topHalf ? 'top-half' : '',
    bottomHalf ? 'bottom-half' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} style={{ left, width }} onClick={onClick}>
      {conflict ? <FaTriangleExclamation className="sc-block-warn" /> : null}
      <span className="sc-block-label">{label}</span>
      <span className="sc-block-time">{time}</span>
      {done ? <span className="sc-block-done-mark">✓</span> : null}
      {active ? <span className="sc-block-pulse"><span /><span /></span> : null}
    </div>
  )
}

function BreakBlock({ left, width }: { left: string; width: string }) {
  return (
    <div className="sc-break-block" style={{ left, width }}>
      <span>BREAK</span>
    </div>
  )
}
