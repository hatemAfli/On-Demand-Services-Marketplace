import { useCallback, useEffect, useState } from 'react'
import { FaSpinner } from 'react-icons/fa6'
import { companyApi } from '../../../../services/companyApi'
import type {
  DayOfWeek,
  ProviderAvailabilityDay,
  ProviderDayOff,
} from '../../../../types/company'
import './EmployeeScheduleEditor.css'

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
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function normalizeWeekly(rows: ProviderAvailabilityDay[]): ProviderAvailabilityDay[] {
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

type Props = {
  providerId: string
  onSaved?: () => void
}

export function EmployeeScheduleEditor({ providerId, onSaved }: Props) {
  const [tab, setTab] = useState<'weekly' | 'daysoff'>('weekly')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weeklyDraft, setWeeklyDraft] = useState<ProviderAvailabilityDay[]>([])
  const [daysOff, setDaysOff] = useState<ProviderDayOff[]>([])
  const [newDayOffDate, setNewDayOffDate] = useState(() => toYyyyMmDd(new Date()))
  const [newDayOffReason, setNewDayOffReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = toYyyyMmDd(new Date())
    try {
      const [weekly, offs] = await Promise.all([
        companyApi.getEmployeeAvailability(providerId),
        companyApi.getEmployeeDaysOff(
          providerId,
          today,
          toYyyyMmDd(addDays(new Date(), 90)),
        ),
      ])
      setWeeklyDraft(normalizeWeekly(weekly))
      setDaysOff(offs)
      setNewDayOffDate(today)
    } catch {
      setWeeklyDraft(normalizeWeekly([]))
      setDaysOff([])
      setError('Could not load schedule. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [providerId])

  useEffect(() => {
    void load()
  }, [load])

  const saveWeekly = async () => {
    setSaving(true)
    setError(null)
    try {
      await companyApi.upsertEmployeeAvailability(providerId, {
        days: weeklyDraft.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorking: d.isWorking,
          startTime: d.startTime,
          endTime: d.endTime,
        })),
      })
      onSaved?.()
    } catch {
      setError('Could not save weekly schedule.')
    } finally {
      setSaving(false)
    }
  }

  const addDayOff = async () => {
    if (!newDayOffDate) return
    setSaving(true)
    setError(null)
    try {
      const created = await companyApi.createEmployeeDayOff(providerId, {
        date: newDayOffDate,
        reason: newDayOffReason.trim() || undefined,
      })
      setDaysOff((prev) =>
        [...prev, created].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      )
      setNewDayOffReason('')
      onSaved?.()
    } catch {
      setError('Could not add day off. It may already be blocked.')
    } finally {
      setSaving(false)
    }
  }

  const removeDayOff = async (dayOffId: string) => {
    setSaving(true)
    setError(null)
    try {
      await companyApi.deleteEmployeeDayOff(providerId, dayOffId)
      setDaysOff((prev) => prev.filter((d) => d.id !== dayOffId))
      onSaved?.()
    } catch {
      setError('Could not remove day off.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="ese-loading">
        <FaSpinner className="ese-spin" /> Loading schedule…
      </div>
    )
  }

  return (
    <div className="ese-root">
      <p className="ese-hint">
        Same schedule settings as independent providers. Changes apply to client
        booking slots immediately.
      </p>

      {error ? <div className="ese-error">{error}</div> : null}

      <div className="ese-tabs">
        <button
          type="button"
          className={tab === 'weekly' ? 'active' : ''}
          onClick={() => setTab('weekly')}
        >
          Weekly hours
        </button>
        <button
          type="button"
          className={tab === 'daysoff' ? 'active' : ''}
          onClick={() => setTab('daysoff')}
        >
          Days off
        </button>
      </div>

      {tab === 'weekly' ? (
        <>
          <div className="ese-weekly-grid">
            {weeklyDraft.map((day) => (
              <div key={day.dayOfWeek} className="ese-weekly-row">
                <label className="ese-day-toggle">
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
                  <div className="ese-time-inputs">
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
                  <span className="ese-off-label">Off</span>
                )}
              </div>
            ))}
          </div>
          <div className="ese-footer">
            <button
              type="button"
              className="ese-save-btn"
              disabled={saving}
              onClick={() => void saveWeekly()}
            >
              {saving ? 'Saving…' : 'Save weekly schedule'}
            </button>
          </div>
        </>
      ) : (
        <div className="ese-daysoff-section">
          <div className="ese-dayoff-form">
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
              className="ese-save-btn"
              disabled={saving || !newDayOffDate}
              onClick={() => void addDayOff()}
            >
              Add
            </button>
          </div>
          <div className="ese-dayoff-list">
            {daysOff.length === 0 ? (
              <p className="ese-dayoff-empty">No upcoming days off.</p>
            ) : (
              daysOff.map((d) => (
                <div key={d.id} className="ese-dayoff-item">
                  <div>
                    <strong>{formatDisplayDate(d.date)}</strong>
                    {d.reason ? <small>{d.reason}</small> : null}
                  </div>
                  <button
                    type="button"
                    className="ese-dayoff-remove"
                    disabled={saving}
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
  )
}
