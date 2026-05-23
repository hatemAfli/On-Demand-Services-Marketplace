import { ArrowLeft, ArrowRight } from 'lucide-react'
import { App as AntdApp, Input, Modal, Segmented, Spin } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge, UserMiniCard } from '../../../../components/admin'
import { adminApi } from '../../../../services/adminApi'
import type { AdminComplaint, ComplaintDecision, ComplaintStatus } from '../../../../types/admin'
import {
  COMPLAINT_CATEGORY_META,
  COMPLAINT_DECISION_META,
  formatPersonName,
  getDecisionLabel,
  pickServiceNameFromAppointment,
} from './complaintMeta'
import './AdminComplaintDetailPage.css'

const { TextArea } = Input

const REVIEW_STATUSES: ComplaintStatus[] = ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']
const DECISION_KEYS = Object.keys(COMPLAINT_DECISION_META) as ComplaintDecision[]

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  return d.isValid() ? d.format('D MMM YYYY, HH:mm') : '—'
}

function isEditable(status: ComplaintStatus): boolean {
  return status === 'OPEN' || status === 'UNDER_REVIEW'
}

export function AdminComplaintDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [complaint, setComplaint] = useState<AdminComplaint | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmModal, setConfirmModal] = useState(false)

  const [reviewStatus, setReviewStatus] = useState<ComplaintStatus>('UNDER_REVIEW')
  const [decision, setDecision] = useState<ComplaintDecision | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [adminResponse, setAdminResponse] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await adminApi.getAdminComplaintById(id)
      const data = res.data
      setComplaint(data)
      setReviewStatus(
        data.status === 'OPEN' ? 'UNDER_REVIEW' : data.status,
      )
      setDecision(data.decision)
      setAdminNotes(data.adminNotes ?? '')
      setAdminResponse(data.adminResponse ?? '')
    } catch (err) {
      message.error(formatApiMessage(err))
      setComplaint(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    void load()
  }, [load])

  const needsDecision =
    reviewStatus === 'RESOLVED' || reviewStatus === 'DISMISSED'

  const canSubmit = useMemo(() => {
    if (!complaint || !isEditable(complaint.status)) return false
    if (!reviewStatus) return false
    if (needsDecision && !decision) return false
    return true
  }, [complaint, reviewStatus, needsDecision, decision])

  const submitReview = async () => {
    if (!id || !canSubmit) return
    setSubmitting(true)
    try {
      await adminApi.reviewComplaint(id, {
        status: reviewStatus,
        adminNotes: adminNotes.trim() || undefined,
        adminResponse: adminResponse.trim() || undefined,
        decision: needsDecision ? (decision ?? undefined) : undefined,
      })
      message.success('Complaint updated')
      setConfirmModal(false)
      await load()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitClick = () => {
    if (
      decision === 'ACCOUNT_SUSPENDED' ||
      decision === 'ACCOUNT_BANNED'
    ) {
      setConfirmModal(true)
      return
    }
    void submitReview()
  }

  if (loading) {
    return (
      <div className="admin-complaint-detail admin-complaint-detail--centered">
        <Spin size="large" />
      </div>
    )
  }

  if (!complaint || !id) {
    return (
      <div className="admin-complaint-detail admin-complaint-detail--centered">
        <p>Complaint not found.</p>
        <button
          type="button"
          className="admin-complaint-detail__link-btn"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    )
  }

  const categoryMeta = COMPLAINT_CATEGORY_META[complaint.category]
  const CategoryIcon = categoryMeta.Icon
  const filedAt = complaint.openedAt ?? complaint.createdAt
  const editable = isEditable(complaint.status)
  const showExistingDecision = !editable

  return (
    <div className="admin-complaint-detail">
      <header className="admin-complaint-detail__header">
        <button
          type="button"
          className="admin-complaint-detail__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="admin-complaint-detail__header-main">
          <h1 className="admin-complaint-detail__title">Complaint</h1>
          <StatusBadge type="complaint" status={complaint.status} size="large" />
          <span className="admin-complaint-detail__filed">
            Filed {formatDateTime(filedAt)}
          </span>
        </div>
      </header>

      {complaint.status === 'OPEN' ? (
        <div className="admin-complaint-detail__banner admin-complaint-detail__banner--amber" role="alert">
          This complaint has not been reviewed yet.
        </div>
      ) : null}

      <section className="admin-complaint-detail__card">
        <h2 className="admin-complaint-detail__section-title">Parties</h2>
        <div className="admin-complaint-detail__parties">
          <div className="admin-complaint-detail__party">
            <span className="admin-complaint-detail__party-label">Client</span>
            <UserMiniCard
              name={formatPersonName(
                complaint.client.user.firstName,
                complaint.client.user.lastName,
              )}
              email={complaint.client.user.email}
              photo={complaint.client.imageUrl}
              role="Client"
            />
          </div>
          <div className="admin-complaint-detail__parties-center">
            <ArrowRight size={28} className="admin-complaint-detail__arrow" aria-hidden />
            <span className="admin-complaint-detail__center-category">
              <CategoryIcon size={20} />
              {categoryMeta.label}
            </span>
          </div>
          <div className="admin-complaint-detail__party">
            <span className="admin-complaint-detail__party-label">Provider</span>
            <UserMiniCard
              name={formatPersonName(
                complaint.provider.user.firstName,
                complaint.provider.user.lastName,
              )}
              email={complaint.provider.user.email}
              photo={complaint.provider.photoUrl}
              role={
                complaint.provider.type === 'EMPLOYEE' ? 'Employee' : 'Independent'
              }
              city={complaint.provider.city}
              extraBadge={
                complaint.provider.totalComplaints > 0
                  ? `${complaint.provider.totalComplaints} total`
                  : undefined
              }
            />
            {complaint.provider.activeComplaints > 0 ? (
              <span className="admin-complaint-detail__active-badge">
                {complaint.provider.activeComplaints} active
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="admin-complaint-detail__card admin-complaint-detail__appointment-row">
        <div>
          <span className="admin-complaint-detail__muted">Linked appointment</span>
          <p className="admin-complaint-detail__appointment-text">
            {pickServiceNameFromAppointment(complaint.appointment)} ·{' '}
            {dayjs(complaint.appointment.scheduledDate).format('D MMM YYYY')} ·{' '}
            {complaint.appointment.scheduledTime}
          </p>
        </div>
        <Link
          to={`/admin/appointments/${complaint.appointment.id}`}
          className="admin-complaint-detail__appointment-link"
        >
          View appointment →
        </Link>
      </section>

      <section className="admin-complaint-detail__card">
        <h2 className="admin-complaint-detail__section-title">Complaint details</h2>
        <div className="admin-complaint-detail__category-large">
          <CategoryIcon size={24} />
          {categoryMeta.label}
        </div>
        <blockquote className="admin-complaint-detail__description">
          {complaint.description}
        </blockquote>
        {complaint.evidenceUrls.length > 0 ? (
          <div>
            <h3 className="admin-complaint-detail__subheading">Evidence photos</h3>
            <div className="admin-complaint-detail__evidence">
              {complaint.evidenceUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-complaint-detail__evidence-thumb"
                >
                  <img src={url} alt="Evidence" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {complaint.targetIsEmployee ? (
          <div
            className="admin-complaint-detail__banner admin-complaint-detail__banner--purple"
            role="note"
          >
            This provider is a company employee. This complaint has been forwarded
            to the company admin.
          </div>
        ) : null}
      </section>

      {editable ? (
        <section className="admin-complaint-detail__card">
          <h2 className="admin-complaint-detail__section-title">Admin response</h2>

          <div className="admin-complaint-detail__step">
            <label className="admin-complaint-detail__label">Status</label>
            <Segmented
              value={reviewStatus}
              onChange={(v) => {
                setReviewStatus(v as ComplaintStatus)
                if (v !== 'RESOLVED' && v !== 'DISMISSED') {
                  setDecision(null)
                }
              }}
              options={REVIEW_STATUSES.map((s) => ({
                label: s
                  .split('_')
                  .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                  .join(' '),
                value: s,
              }))}
              block
            />
          </div>

          {needsDecision ? (
            <div className="admin-complaint-detail__step">
              <label className="admin-complaint-detail__label">Decision</label>
              <div className="admin-complaint-detail__decision-grid">
                {DECISION_KEYS.map((key) => {
                  const meta = COMPLAINT_DECISION_META[key]
                  const Icon = meta.Icon
                  const selected = decision === key
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`admin-complaint-detail__decision-card admin-complaint-detail__decision-card--${meta.tone}${selected ? ' admin-complaint-detail__decision-card--selected' : ''}`}
                      onClick={() => setDecision(key)}
                    >
                      <Icon size={22} aria-hidden />
                      <span className="admin-complaint-detail__decision-title">
                        {meta.label}
                      </span>
                      <span className="admin-complaint-detail__decision-desc">
                        {meta.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="admin-complaint-detail__step">
            <label className="admin-complaint-detail__label" htmlFor="admin-notes">
              Internal notes (not visible to client)
            </label>
            <TextArea
              id="admin-notes"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              maxLength={3000}
              showCount
            />
          </div>

          <div className="admin-complaint-detail__step">
            <label className="admin-complaint-detail__label" htmlFor="admin-response">
              Message to client (shown in their app)
            </label>
            <TextArea
              id="admin-response"
              rows={4}
              value={adminResponse}
              onChange={(e) => setAdminResponse(e.target.value)}
              maxLength={1000}
              showCount
            />
          </div>

          <button
            type="button"
            className="admin-complaint-detail__submit"
            disabled={!canSubmit || submitting}
            onClick={() => void handleSubmitClick()}
          >
            Submit decision
          </button>
        </section>
      ) : null}

      {showExistingDecision ? (
        <section className="admin-complaint-detail__card">
          <h2 className="admin-complaint-detail__section-title">Decision record</h2>
          {complaint.decision ? (
            <span className="admin-complaint-detail__decision-chip">
              {getDecisionLabel(complaint.decision)}
            </span>
          ) : null}
          {complaint.adminNotes ? (
            <div className="admin-complaint-detail__readonly admin-complaint-detail__readonly--gray">
              <span className="admin-complaint-detail__readonly-label">
                Internal notes
              </span>
              <p>{complaint.adminNotes}</p>
            </div>
          ) : null}
          {complaint.adminResponse ? (
            <div className="admin-complaint-detail__readonly admin-complaint-detail__readonly--blue">
              <span className="admin-complaint-detail__readonly-label">
                Sent to client
              </span>
              <p>{complaint.adminResponse}</p>
            </div>
          ) : null}
          <p className="admin-complaint-detail__handled">
            Handled by:{' '}
            {complaint.handledByAdmin
              ? formatPersonName(
                  complaint.handledByAdmin.user.firstName,
                  complaint.handledByAdmin.user.lastName,
                )
              : '—'}
            {complaint.resolvedAt
              ? ` · Resolved ${formatDateTime(complaint.resolvedAt)}`
              : complaint.reviewedAt
                ? ` · Reviewed ${formatDateTime(complaint.reviewedAt)}`
                : ''}
          </p>
        </section>
      ) : null}

      <Modal
        title="Confirm severe action"
        open={confirmModal}
        onCancel={() => !submitting && setConfirmModal(false)}
        onOk={() => void submitReview()}
        okText="Confirm"
        okButtonProps={{ danger: true }}
        confirmLoading={submitting}
      >
        <p>
          You are about to{' '}
          {decision === 'ACCOUNT_BANNED'
            ? 'permanently ban'
            : 'suspend'}{' '}
          this provider account. This cannot be undone lightly. Continue?
        </p>
      </Modal>
    </div>
  )
}
