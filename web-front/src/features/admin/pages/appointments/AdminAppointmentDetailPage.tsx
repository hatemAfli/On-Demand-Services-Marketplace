import { ArrowLeft } from 'lucide-react'
import { Modal, Input, App as AntdApp, Spin } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge, UserMiniCard } from '../../../../components/admin'
import { adminApi } from '../../../../services/adminApi'
import type {
  AdminAppointment,
  AppointmentStatus,
  ComplaintCategory,
} from '../../../../types/admin'
import './AdminAppointmentDetailPage.css'

const { TextArea } = Input

const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  SERVICE_QUALITY: 'Service quality',
  NO_SHOW: 'No-show',
  LATE_ARRIVAL: 'Late arrival',
  UNPROFESSIONAL: 'Unprofessional',
  OVERCHARGING: 'Overcharging',
  PROPERTY_DAMAGE: 'Property damage',
  SAFETY_CONCERN: 'Safety concern',
  FRAUD: 'Fraud',
  OTHER: 'Other',
}

const ACTIONABLE_STATUSES: AppointmentStatus[] = [
  'CONFIRMED',
  'IN_PROGRESS',
  'DISPUTED',
]

function formatPersonName(first: string, last: string): string {
  return `${first} ${last}`.trim() || '—'
}

function pickServiceName(row: AdminAppointment): string {
  const translations = row.givenService?.service?.translations ?? []
  const en = translations.find((t) => t.locale === 'EN' || t.locale === 'en')
  return (en ?? translations[0])?.name?.trim() || 'Service'
}

function formatPricingType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  return d.isValid() ? d.format('D MMM YYYY, HH:mm') : '—'
}

function formatScheduledDate(date: string): string {
  const d = dayjs(date)
  return d.isValid() ? d.format('ddd D MMM YYYY') : date
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function isConfirmedMilestone(status: AppointmentStatus): boolean {
  return !['PENDING', 'REFUSED'].includes(status)
}

type TimelineStep = {
  key: string
  label: string
  at: string | null
  completed: boolean
}

function buildTimeline(appt: AdminAppointment): TimelineStep[] {
  const { status } = appt
  const isCancelled =
    status === 'CANCELLED_CLIENT' ||
    status === 'CANCELLED_PROVIDER' ||
    status === 'REFUSED'
  const isDisputed = status === 'DISPUTED'
  const isCompleted = status === 'COMPLETED'

  const steps: TimelineStep[] = [
    {
      key: 'created',
      label: 'Created',
      at: appt.createdAt,
      completed: true,
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      at: null,
      completed: isConfirmedMilestone(status),
    },
    {
      key: 'enRoute',
      label: 'En route',
      at: appt.enRouteAt,
      completed: Boolean(appt.enRouteAt),
    },
    {
      key: 'started',
      label: 'Started',
      at: appt.startedAt,
      completed: Boolean(appt.startedAt),
    },
  ]

  if (isCancelled) {
    steps.push({
      key: 'cancelled',
      label: status === 'REFUSED' ? 'Refused' : 'Cancelled',
      at: appt.cancelledAt,
      completed: Boolean(appt.cancelledAt),
    })
  } else if (isDisputed) {
    steps.push({
      key: 'disputed',
      label: 'Disputed',
      at: appt.updatedAt,
      completed: true,
    })
  } else {
    steps.push({
      key: 'completed',
      label: 'Completed',
      at: appt.completedAt,
      completed: isCompleted || Boolean(appt.completedAt),
    })
  }

  return steps
}

type InterveneAction = 'FORCE_COMPLETE' | 'FORCE_CANCEL'

export function AdminAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [appointment, setAppointment] = useState<AdminAppointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [interveneModal, setInterveneModal] = useState<InterveneAction | null>(null)
  const [interveneReason, setInterveneReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await adminApi.getAdminAppointmentById(id)
      setAppointment(res.data)
    } catch (err) {
      message.error(formatApiMessage(err))
      setAppointment(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    void load()
  }, [load])

  const timeline = useMemo(
    () => (appointment ? buildTimeline(appointment) : []),
    [appointment],
  )

  const showActions =
    appointment != null && ACTIONABLE_STATUSES.includes(appointment.status)

  const handleFlagDisputed = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.flagAppointmentAsDisputed(id)
      message.success('Appointment flagged as disputed')
      await load()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleIntervene = async () => {
    if (!id || !interveneModal) return
    const reason = interveneReason.trim()
    if (!reason) {
      message.warning('Please enter a reason')
      return
    }
    setActionLoading(true)
    try {
      await adminApi.interveneAppointment(id, {
        action: interveneModal,
        reason,
      })
      message.success(
        interveneModal === 'FORCE_COMPLETE'
          ? 'Appointment marked as completed'
          : 'Appointment cancelled',
      )
      setInterveneModal(null)
      setInterveneReason('')
      await load()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-appt-detail admin-appt-detail--centered">
        <Spin size="large" />
      </div>
    )
  }

  if (!appointment || !id) {
    return (
      <div className="admin-appt-detail admin-appt-detail--centered">
        <p>Appointment not found.</p>
        <button
          type="button"
          className="admin-appt-detail__back-link"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    )
  }

  const shortId = id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const providerTypeLabel =
    appointment.provider.type === 'EMPLOYEE' ? 'Employee' : 'Independent'

  return (
    <div className="admin-appt-detail">
      <header className="admin-appt-detail__header">
        <button
          type="button"
          className="admin-appt-detail__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="admin-appt-detail__header-main">
          <h1 className="admin-appt-detail__title">Appointment #{shortId}</h1>
          <StatusBadge
            type="appointment"
            status={appointment.status}
            size="large"
          />
        </div>
      </header>

      {appointment.status === 'DISPUTED' ? (
        <div className="admin-appt-detail__dispute-banner" role="alert">
          ⚠️ Active dispute — admin intervention may be required
        </div>
      ) : null}

      <section className="admin-appt-detail__card">
        <h2 className="admin-appt-detail__section-title">Parties</h2>
        <div className="admin-appt-detail__parties">
          <div className="admin-appt-detail__party">
            <span className="admin-appt-detail__party-label">Client</span>
            <UserMiniCard
              name={formatPersonName(
                appointment.client.user.firstName,
                appointment.client.user.lastName,
              )}
              email={appointment.client.user.email}
              photo={appointment.client.imageUrl}
              role="Client"
            />
          </div>
          <div className="admin-appt-detail__party">
            <span className="admin-appt-detail__party-label">Provider</span>
            <UserMiniCard
              name={formatPersonName(
                appointment.provider.user.firstName,
                appointment.provider.user.lastName,
              )}
              email={appointment.provider.user.email}
              photo={appointment.provider.photoUrl}
              role={providerTypeLabel}
              city={appointment.provider.city}
              extraBadge={
                appointment.provider.totalComplaints > 0
                  ? `${appointment.provider.totalComplaints} complaint(s)`
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      <section className="admin-appt-detail__card">
        <h2 className="admin-appt-detail__section-title">Booking details</h2>
        <dl className="admin-appt-detail__grid">
          <div>
            <dt>Service</dt>
            <dd>{pickServiceName(appointment)}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>
              {appointment.givenService.price}{' '}
              <span className="admin-appt-detail__muted">
                ({formatPricingType(appointment.givenService.pricingType)})
              </span>
            </dd>
          </div>
          <div>
            <dt>Scheduled</dt>
            <dd>
              {formatScheduledDate(appointment.scheduledDate)} ·{' '}
              {appointment.scheduledTime}
            </dd>
          </div>
          {appointment.notes ? (
            <div className="admin-appt-detail__grid--full">
              <dt>Notes</dt>
              <dd>{appointment.notes}</dd>
            </div>
          ) : null}
          {appointment.durationMinutes != null ? (
            <div>
              <dt>Duration</dt>
              <dd>{appointment.durationMinutes} min</dd>
            </div>
          ) : null}
          {appointment.cancellationReason ? (
            <div className="admin-appt-detail__grid--full">
              <dt>Cancellation</dt>
              <dd>
                {appointment.cancelledBy
                  ? `By ${appointment.cancelledBy}: `
                  : ''}
                {appointment.cancellationReason}
                {appointment.cancelledAt
                  ? ` (${formatDateTime(appointment.cancelledAt)})`
                  : ''}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="admin-appt-detail__card">
        <h2 className="admin-appt-detail__section-title">Timeline</h2>
        <ol className="admin-appt-detail__timeline">
          {timeline.map((step) => (
            <li
              key={step.key}
              className={`admin-appt-detail__timeline-step${step.completed ? ' admin-appt-detail__timeline-step--done' : ''}`}
            >
              <span className="admin-appt-detail__timeline-dot" aria-hidden />
              <div>
                <span className="admin-appt-detail__timeline-label">
                  {step.label}
                </span>
                <span className="admin-appt-detail__timeline-time">
                  {formatDateTime(step.at)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="admin-appt-detail__card">
        <h2 className="admin-appt-detail__section-title">Review</h2>
        {appointment.review ? (
          <div className="admin-appt-detail__review">
            <p className="admin-appt-detail__review-rating">
              {'⭐'.repeat(appointment.review.rating)}
              <span className="admin-appt-detail__review-score">
                {appointment.review.rating}/5
              </span>
            </p>
            {appointment.review.comment ? (
              <p className="admin-appt-detail__review-comment">
                {appointment.review.comment}
              </p>
            ) : (
              <p className="admin-appt-detail__muted">No written comment</p>
            )}
          </div>
        ) : (
          <p className="admin-appt-detail__muted">No review submitted</p>
        )}
      </section>

      {appointment.complaints.length > 0 ? (
        <section className="admin-appt-detail__card">
          <h2 className="admin-appt-detail__section-title">Linked complaints</h2>
          <ul className="admin-appt-detail__complaints">
            {appointment.complaints.map((c) => (
              <li key={c.id} className="admin-appt-detail__complaint-chip">
                <span>
                  {COMPLAINT_CATEGORY_LABELS[c.category] ?? c.category}
                </span>
                <StatusBadge type="complaint" status={c.status} />
                <Link
                  to={`/admin/reclamations/${c.id}`}
                  className="admin-appt-detail__complaint-link"
                >
                  View complaint →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showActions ? (
        <section className="admin-appt-detail__card admin-appt-detail__actions">
          <h2 className="admin-appt-detail__section-title">Admin actions</h2>
          <div className="admin-appt-detail__action-row">
            {appointment.status !== 'DISPUTED' ? (
              <button
                type="button"
                className="admin-appt-detail__btn admin-appt-detail__btn--amber"
                disabled={actionLoading}
                onClick={() => void handleFlagDisputed()}
              >
                Flag as disputed
              </button>
            ) : null}
            <button
              type="button"
              className="admin-appt-detail__btn admin-appt-detail__btn--green"
              disabled={actionLoading}
              onClick={() => {
                setInterveneModal('FORCE_COMPLETE')
                setInterveneReason('')
              }}
            >
              Force complete
            </button>
            <button
              type="button"
              className="admin-appt-detail__btn admin-appt-detail__btn--red"
              disabled={actionLoading}
              onClick={() => {
                setInterveneModal('FORCE_CANCEL')
                setInterveneReason('')
              }}
            >
              Force cancel
            </button>
          </div>
        </section>
      ) : null}

      <Modal
        title={
          interveneModal === 'FORCE_COMPLETE'
            ? 'Force complete appointment'
            : 'Force cancel appointment'
        }
        open={interveneModal != null}
        onCancel={() => {
          if (!actionLoading) {
            setInterveneModal(null)
            setInterveneReason('')
          }
        }}
        onOk={() => void handleIntervene()}
        okText="Confirm"
        confirmLoading={actionLoading}
        destroyOnHidden
      >
        <p className="admin-appt-detail__modal-hint">
          This action is logged and both parties will be notified. Reason is
          required.
        </p>
        <TextArea
          rows={4}
          value={interveneReason}
          onChange={(e) => setInterveneReason(e.target.value)}
          placeholder="Enter reason for this intervention…"
          maxLength={2000}
          showCount
        />
      </Modal>
    </div>
  )
}
