import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FaBell,
  FaCalendarDay,
  FaChevronLeft,
  FaChevronRight,
  FaMagnifyingGlass,
  FaRotate,
  FaTriangleExclamation,
  FaUserGear,
  FaXmark,
} from 'react-icons/fa6'
import { FaRegClock } from 'react-icons/fa'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyDaySchedule,
  CompanyScheduleAppointment,
  CompanyScheduleEmployee,
  DayOfWeek,
  ProviderAvailabilityDay,
  ProviderDayOff,
} from '../../../../types/company'
import './CompanySchedulePage.css'

const DAY_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
}

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function timeToMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(':').map(Number)
  return hh * 60 + mm
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function endTimeFrom(start: string, durationMinutes: number): string {
  const total = timeToMinutes(start) + durationMinutes
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')
  return `${hh}:${mm}`
}

function blockPosition(
  startMinutes: number,
  endMinutes: number,
  gridStart: number,
  gridEnd: number,
): { left: string; width: string } {
  const total = gridEnd - gridStart
  if (total <= 0) return { left: '0%', width: '0%' }
  const left = ((startMinutes - gridStart) / total) * 100
  const width = ((endMinutes - startMinutes) / total) * 100
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.max(1.5, width)}%`,
  }
}

function blockColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'green'
    case 'IN_PROGRESS':
    case 'EN_ROUTE':
      return 'blue'
    case 'PENDING':
    case 'CONFIRMED':
    case 'RESCHEDULED':
      return 'purple'
    default:
      return 'gray'
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function normalizeWeekly(rows: ProviderAvailabilityDay[]) {
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]))
  return DAY_ORDER.map(
    (dayOfWeek) =>
      byDay.get(dayOfWeek) ?? {
        id: `default-${dayOfWeek}`,
        providerId: '',
        dayOfWeek,
        isWorking: dayOfWeek !== 'SATURDAY' && dayOfWeek !== 'SUNDAY',
        startTime: '08:00',
        endTime: '18:00',
      },
  )
}

export function CompanySchedulePage() {
  const [selectedDate, setSelectedDate] = useState(() => toYyyyMmDd(new Date()))
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [schedule, setSchedule] = useState<CompanyDaySchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editorEmployee, setEditorEmployee] =
    useState<CompanyScheduleEmployee | null>(null)
  const [editorTab, setEditorTab] = useState<'weekly' | 'daysoff'>('weekly')
  const [weeklyDraft, setWeeklyDraft] = useState<ProviderAvailabilityDay[]>([])
  const [daysOff, setDaysOff] = useState<ProviderDayOff[]>([])
  const [newDayOffDate, setNewDayOffDate] = useState('')
  const [newDayOffReason, setNewDayOffReason] = useState('')
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)

  const providerScrollRef = useRef<HTMLDivElement>(null)
  const gridScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await companyApi.getCompanyDaySchedule({
        date: selectedDate,
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setSchedule(data)
    } catch {
      setError('Could not load schedule. Please try again.')
      setSchedule(null)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, search])

  useEffect(() => {
    void loadSchedule()
  }, [loadSchedule])

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
  }, [schedule])

  const gridStartMin = schedule ? timeToMinutes(schedule.gridStart) : 480
  const gridEndMin = schedule ? timeToMinutes(schedule.gridEnd) : 1080

  const avgLoad = useMemo(() => {
    if (!schedule?.employees.length) return 0
    const working = schedule.employees.filter(
      (e) => e.isWorkingToday && !e.isDayOff,
    )
    if (!working.length) return 0
    return Math.round(
      working.reduce((s, e) => s + e.loadPct, 0) / working.length,
    )
  }, [schedule])

  const openEditor = useCallback(async (emp: CompanyScheduleEmployee) => {
    setEditorEmployee(emp)
    setEditorTab('weekly')
    setEditorLoading(true)
    setNewDayOffDate(selectedDate)
    setNewDayOffReason('')
    try {
      const [weekly, offs] = await Promise.all([
        companyApi.getEmployeeAvailability(emp.id),
        companyApi.getEmployeeDaysOff(
          emp.id,
          selectedDate,
          toYyyyMmDd(addDays(new Date(`${selectedDate}T12:00:00`), 90)),
        ),
      ])
      setWeeklyDraft(normalizeWeekly(weekly))
      setDaysOff(offs)
    } catch {
      setWeeklyDraft(normalizeWeekly([]))
      setDaysOff([])
    } finally {
      setEditorLoading(false)
    }
  }, [selectedDate])

  const saveWeekly = useCallback(async () => {
    if (!editorEmployee) return
    setEditorSaving(true)
    try {
      await companyApi.upsertEmployeeAvailability(editorEmployee.id, {
        days: weeklyDraft.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorking: d.isWorking,
          startTime: d.startTime,
          endTime: d.endTime,
        })),
      })
      setEditorEmployee(null)
      await loadSchedule()
    } catch {
      /* ignore */
    } finally {
      setEditorSaving(false)
    }
  }, [editorEmployee, weeklyDraft, loadSchedule])

  const addDayOff = useCallback(async () => {
    if (!editorEmployee || !newDayOffDate) return
    setEditorSaving(true)
    try {
      const created = await companyApi.createEmployeeDayOff(editorEmployee.id, {
        date: newDayOffDate,
        reason: newDayOffReason.trim() || undefined,
      })
      setDaysOff((prev) =>
        [...prev, created].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      )
      setNewDayOffReason('')
      await loadSchedule()
    } catch {
      /* ignore */
    } finally {
      setEditorSaving(false)
    }
  }, [editorEmployee, newDayOffDate, newDayOffReason, loadSchedule])

  const removeDayOff = useCallback(
    async (dayOffId: string) => {
      if (!editorEmployee) return
      setEditorSaving(true)
      try {
        await companyApi.deleteEmployeeDayOff(editorEmployee.id, dayOffId)
        setDaysOff((prev) => prev.filter((d) => d.id !== dayOffId))
        await loadSchedule()
      } catch {
        /* ignore */
      } finally {
        setEditorSaving(false)
      }
    },
    [editorEmployee, loadSchedule],
  )

  return (
    <div className="sc-root">
      {/* Date navigation */}
      <div className="sc-date-nav">
        <button
          type="button"
          className="sc-date-btn"
          onClick={() =>
            setSelectedDate(toYyyyMmDd(addDays(new Date(`${selectedDate}T12:00:00`), -1)))
          }
        >
          <FaChevronLeft />
        </button>
        <div className="sc-date-center">
          <FaCalendarDay />
          <strong>{formatDisplayDate(selectedDate)}</strong>
        </div>
        <button
          type="button"
          className="sc-date-btn"
          onClick={() =>
            setSelectedDate(toYyyyMmDd(addDays(new Date(`${selectedDate}T12:00:00`), 1)))
          }
        >
          <FaChevronRight />
        </button>
        <button
          type="button"
          className="sc-today-btn"
          onClick={() => setSelectedDate(toYyyyMmDd(new Date()))}
        >
          Today
        </button>
        <button type="button" className="sc-refresh-btn" onClick={() => void loadSchedule()}>
          <FaRotate />
        </button>
      </div>

      {/* Top info row */}
      <div className="sc-top-grid">
        <div className="sc-capacity-card">
          <div className="sc-capacity-head">
            <div>
              <h3>Team Capacity Overview</h3>
              <p>Utilization for {formatDisplayDate(selectedDate)}</p>
            </div>
            <div className="sc-legend">
              <span><em className="dot green" />Optimal (&lt;70%)</span>
              <span><em className="dot yellow" />High (70–89%)</span>
              <span><em className="dot red" />Critical (≥90%)</span>
            </div>
          </div>

          <div className="sc-bars-grid sc-bars-grid-3">
            <CapacityBar
              label="Working today"
              pct={
                schedule?.stats.totalEmployees
                  ? Math.round(
                      (schedule.stats.workingToday / schedule.stats.totalEmployees) *
                        100,
                    )
                  : 0
              }
              sub={`${schedule?.stats.workingToday ?? 0} / ${schedule?.stats.totalEmployees ?? 0} providers`}
              color={
                (schedule?.stats.workingToday ?? 0) >=
                (schedule?.stats.totalEmployees ?? 1)
                  ? 'green'
                  : 'yellow'
              }
            />
            <CapacityBar
              label="Average load"
              pct={avgLoad}
              sub="Booked time vs available hours"
              color={avgLoad >= 90 ? 'red' : avgLoad >= 70 ? 'yellow' : 'green'}
            />
            <CapacityBar
              label="On day off"
              pct={
                schedule?.stats.totalEmployees
                  ? Math.round(
                      (schedule.stats.onDayOff / schedule.stats.totalEmployees) * 100,
                    )
                  : 0
              }
              sub={`${schedule?.stats.onDayOff ?? 0} unavailable`}
              color="yellow"
            />
          </div>
        </div>

        <div className="sc-alerts-card">
          <div className="sc-alerts-head">
            <h3><FaBell className="sc-bell" /> Alerts &amp; Conflicts</h3>
            {(schedule?.conflicts.length ?? 0) > 0 ? (
              <span className="sc-critical-badge">
                {schedule!.conflicts.length} Critical
              </span>
            ) : null}
          </div>
          <div className="sc-alerts-list">
            {!schedule?.conflicts.length ? (
              <div className="sc-alert-empty">No scheduling conflicts today.</div>
            ) : (
              schedule.conflicts.map((c) => (
                <div
                  key={c.providerId}
                  className="sc-alert red"
                  onClick={() => setConflictOpen(true)}
                >
                  <span className="sc-alert-icon red"><FaTriangleExclamation /></span>
                  <div>
                    <strong>Double booking detected</strong>
                    <p>
                      {c.providerName} has {c.appointments.length} overlapping
                      bookings.
                    </p>
                    <button type="button" onClick={() => setConflictOpen(true)}>
                      View details
                    </button>
                  </div>
                </div>
              ))
            )}
            {(schedule?.stats.offSchedule ?? 0) > 0 ? (
              <div className="sc-alert yellow">
                <span className="sc-alert-icon yellow"><FaRegClock /></span>
                <div>
                  <strong>Off-schedule providers</strong>
                  <p>
                    {schedule!.stats.offSchedule} provider(s) are not scheduled to
                    work today.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Schedule block */}
      <div className="sc-schedule-card">
        <div className="sc-schedule-toolbar">
          <div className="sc-toolbar-left">
            <div className="sc-filter-search">
              <FaMagnifyingGlass className="sc-search-icon" />
              <input
                type="text"
                placeholder="Filter providers..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          <div className="sc-legend-row">
            <span><em className="sq purple" />Scheduled</span>
            <span><em className="sq green" />Completed</span>
            <span><em className="sq gray" />Off / Break</span>
          </div>
        </div>

        {loading ? (
          <div className="sc-loading">Loading schedule…</div>
        ) : error ? (
          <div className="sc-loading sc-error">{error}</div>
        ) : !schedule?.employees.length ? (
          <div className="sc-loading">No team members found.</div>
        ) : (
          <div className="sc-gantt">
            <div className="sc-provider-col">
              <div className="sc-col-header">
                Providers ({schedule.employees.length})
              </div>
              <div className="sc-provider-list" ref={providerScrollRef}>
                {schedule.employees.map((p) => (
                  <div
                    key={p.id}
                    className={`sc-provider-row${p.hasConflict ? ' conflict' : ''}${p.isDayOff || !p.isWorkingToday ? ' off' : ''}`}
                  >
                    <div className="sc-prov-avatar-wrap">
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt={p.displayName}
                          className={p.isDayOff || !p.isWorkingToday ? 'grayscale' : ''}
                        />
                      ) : (
                        <span className="sc-prov-initials">{initials(p.displayName)}</span>
                      )}
                      {p.hasConflict ? <span className="sc-conflict-badge">!</span> : null}
                    </div>
                    <div className="sc-prov-info">
                      <strong className={p.isDayOff || !p.isWorkingToday ? 'muted' : ''}>
                        {p.displayName}
                      </strong>
                      <small className={p.isDayOff || !p.isWorkingToday ? 'muted' : ''}>
                        {p.city}
                      </small>
                      {p.isDayOff ? (
                        <span className="sc-off-badge">Day off</span>
                      ) : !p.isWorkingToday ? (
                        <span className="sc-off-badge">Off schedule</span>
                      ) : (
                        <div className="sc-load-bar-wrap">
                          <div className="sc-load-track">
                            <div
                              className={`sc-load-fill ${p.loadPct >= 90 ? 'red' : p.loadPct >= 70 ? 'yellow' : 'green'}`}
                              style={{ width: `${p.loadPct}%` }}
                            />
                          </div>
                          <span className={`sc-load-label ${p.loadPct >= 90 ? 'red' : ''}`}>
                            {p.hasConflict ? 'Conflict' : `${p.loadPct}% Load`}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="sc-manage-btn"
                      title="Manage schedule"
                      onClick={() => void openEditor(p)}
                    >
                      <FaUserGear />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sc-timeline-col">
              <div className="sc-time-header">
                {schedule.hours.map((h) => (
                  <div key={h} className="sc-time-cell">{h}</div>
                ))}
              </div>

              <div className="sc-grid-rows" ref={gridScrollRef}>
                <div className="sc-grid-lines" />

                {schedule.employees.map((p) => (
                  <div
                    key={p.id}
                    className={`sc-grid-row${p.isDayOff || !p.isWorkingToday ? ' off' : ''}`}
                  >
                    {p.isDayOff ? (
                      <span className="sc-off-label">
                        Day off{p.dayOffReason ? ` — ${p.dayOffReason}` : ''}
                      </span>
                    ) : !p.isWorkingToday ? (
                      <span className="sc-off-label">Not scheduled today</span>
                    ) : (
                      p.appointments.map((appt) => (
                        <ScheduleBlock
                          key={appt.id}
                          appt={appt}
                          gridStart={gridStartMin}
                          gridEnd={gridEndMin}
                          onClick={() => setSelectedApptId(appt.id)}
                        />
                      ))
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedule editor modal */}
      {editorEmployee ? (
        <div className="sc-modal-overlay" onClick={() => setEditorEmployee(null)}>
          <div className="sc-modal sc-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="sc-modal-header">
              <div>
                <h3>Manage schedule — {editorEmployee.displayName}</h3>
                <p>Set weekly hours and days off (same as independent provider schedule)</p>
              </div>
              <button type="button" onClick={() => setEditorEmployee(null)}>
                <FaXmark />
              </button>
            </div>

            <div className="sc-editor-tabs">
              <button
                type="button"
                className={editorTab === 'weekly' ? 'active' : ''}
                onClick={() => setEditorTab('weekly')}
              >
                Weekly hours
              </button>
              <button
                type="button"
                className={editorTab === 'daysoff' ? 'active' : ''}
                onClick={() => setEditorTab('daysoff')}
              >
                Days off
              </button>
            </div>

            <div className="sc-modal-body">
              {editorLoading ? (
                <div className="sc-loading">Loading…</div>
              ) : editorTab === 'weekly' ? (
                <div className="sc-weekly-grid">
                  {weeklyDraft.map((day) => (
                    <div key={day.dayOfWeek} className="sc-weekly-row">
                      <label className="sc-day-toggle">
                        <input
                          type="checkbox"
                          checked={day.isWorking}
                          onChange={(e) =>
                            setWeeklyDraft((prev) =>
                              prev.map((d) =>
                                d.dayOfWeek === day.dayOfWeek
                                  ? { ...d, isWorking: e.target.checked }
                                  : d,
                              ),
                            )
                          }
                        />
                        <span>{DAY_LABELS[day.dayOfWeek]}</span>
                      </label>
                      {day.isWorking ? (
                        <div className="sc-time-inputs">
                          <input
                            type="time"
                            value={day.startTime}
                            onChange={(e) =>
                              setWeeklyDraft((prev) =>
                                prev.map((d) =>
                                  d.dayOfWeek === day.dayOfWeek
                                    ? { ...d, startTime: e.target.value }
                                    : d,
                                ),
                              )
                            }
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={day.endTime}
                            onChange={(e) =>
                              setWeeklyDraft((prev) =>
                                prev.map((d) =>
                                  d.dayOfWeek === day.dayOfWeek
                                    ? { ...d, endTime: e.target.value }
                                    : d,
                                ),
                              )
                            }
                          />
                        </div>
                      ) : (
                        <span className="sc-day-off-label">Off</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sc-daysoff-section">
                  <div className="sc-dayoff-form">
                    <input
                      type="date"
                      value={newDayOffDate}
                      onChange={(e) => setNewDayOffDate(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={newDayOffReason}
                      onChange={(e) => setNewDayOffReason(e.target.value)}
                    />
                    <button
                      type="button"
                      className="sc-btn-primary"
                      disabled={editorSaving || !newDayOffDate}
                      onClick={() => void addDayOff()}
                    >
                      Add day off
                    </button>
                  </div>
                  <div className="sc-dayoff-list">
                    {daysOff.length === 0 ? (
                      <p className="sc-dayoff-empty">No upcoming days off.</p>
                    ) : (
                      daysOff.map((d) => (
                        <div key={d.id} className="sc-dayoff-item">
                          <div>
                            <strong>{formatDisplayDate(d.date.slice(0, 10))}</strong>
                            {d.reason ? <small>{d.reason}</small> : null}
                          </div>
                          <button
                            type="button"
                            className="sc-dayoff-remove"
                            disabled={editorSaving}
                            onClick={() => void removeDayOff(d.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {editorTab === 'weekly' ? (
              <div className="sc-modal-footer">
                <button
                  type="button"
                  className="sc-btn-ghost"
                  onClick={() => setEditorEmployee(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sc-btn-primary"
                  disabled={editorSaving}
                  onClick={() => void saveWeekly()}
                >
                  {editorSaving ? 'Saving…' : 'Save weekly schedule'}
                </button>
              </div>
            ) : (
              <div className="sc-modal-footer">
                <button
                  type="button"
                  className="sc-btn-ghost"
                  onClick={() => setEditorEmployee(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Conflict modal */}
      {conflictOpen && schedule?.conflicts.length ? (
        <div className="sc-modal-overlay" onClick={() => setConflictOpen(false)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sc-modal-header">
              <h3>Schedule conflicts</h3>
              <button type="button" onClick={() => setConflictOpen(false)}>
                <FaXmark />
              </button>
            </div>
            <div className="sc-modal-body">
              {schedule.conflicts.map((c) => (
                <div key={c.providerId} className="sc-conflict-group">
                  <strong>{c.providerName}</strong>
                  {c.appointments.map((a) => (
                    <div key={a.id} className="sc-conflict-booking">
                      <span>{a.serviceName}</span>
                      <span>
                        {a.scheduledTime} – {endTimeFrom(a.scheduledTime, a.durationMinutes)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="sc-modal-footer">
              <button type="button" className="sc-btn-ghost" onClick={() => setConflictOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Appointment quick view */}
      {selectedApptId ? (
        <>
          <div className="sc-drawer-backdrop" onClick={() => setSelectedApptId(null)} />
          <aside className="sc-drawer">
            <div className="sc-drawer-header">
              <h2>Appointment</h2>
              <button type="button" onClick={() => setSelectedApptId(null)}>
                <FaXmark />
              </button>
            </div>
            <div className="sc-drawer-body">
              {(() => {
                const appt = schedule?.employees
                  .flatMap((e) => e.appointments)
                  .find((a) => a.id === selectedApptId)
                if (!appt) return <p>Appointment not found.</p>
                return (
                  <>
                    <div className="sc-order-hero">
                      <div>
                        <small>{appt.status}</small>
                        <h3>{appt.serviceName}</h3>
                        <div className="sc-order-meta">
                          <span>
                            <FaRegClock /> {appt.scheduledTime} –{' '}
                            {endTimeFrom(appt.scheduledTime, appt.durationMinutes)}
                          </span>
                          <span>{formatDuration(appt.durationMinutes)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="sc-order-customer">
                      <p>Customer</p>
                      <strong>{appt.clientName}</strong>
                    </div>
                    <p className="sc-drawer-hint">
                      Manage this order from the Orders page (accept, refuse, reassign).
                    </p>
                  </>
                )
              })()}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

function CapacityBar({
  label,
  pct,
  sub,
  color,
}: {
  label: string
  pct: number
  sub: string
  color: 'green' | 'yellow' | 'red'
}) {
  return (
    <div className="sc-bar-item">
      <div className="sc-bar-top">
        <span className="sc-bar-label">{label}</span>
        <strong className={`sc-bar-val ${color}`}>{pct}%</strong>
      </div>
      <div className="sc-bar-track">
        <div className={`sc-bar-fill ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="sc-bar-sub"><span>{sub}</span></div>
    </div>
  )
}

function ScheduleBlock({
  appt,
  gridStart,
  gridEnd,
  onClick,
}: {
  appt: CompanyScheduleAppointment
  gridStart: number
  gridEnd: number
  onClick: () => void
}) {
  const color = blockColor(appt.status)
  const { left, width } = blockPosition(
    appt.startMinutes,
    appt.endMinutes,
    gridStart,
    gridEnd,
  )
  const done = appt.status === 'COMPLETED'
  const active = appt.status === 'IN_PROGRESS' || appt.status === 'EN_ROUTE'

  return (
    <div
      className={`sc-block sc-block-${color}${done ? ' done' : ''}${active ? ' active' : ''}`}
      style={{ left, width }}
      onClick={onClick}
    >
      <span className="sc-block-label">{appt.serviceName}</span>
      <span className="sc-block-time">
        {appt.scheduledTime} – {endTimeFrom(appt.scheduledTime, appt.durationMinutes)}
      </span>
      {done ? <span className="sc-block-done-mark">✓</span> : null}
    </div>
  )
}
