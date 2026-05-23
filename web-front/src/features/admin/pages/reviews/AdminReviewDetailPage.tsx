import { ArrowLeft, EyeOff } from 'lucide-react'
import { App as AntdApp, Input, Modal, Spin } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatusBadge, UserMiniCard } from '../../../../components/admin'
import { adminApi } from '../../../../services/adminApi'
import type { AdminReview } from '../../../../types/admin'
import {
  formatPersonName,
  formatRatingNumber,
  renderStars,
} from './reviewUtils'
import './AdminReviewDetailPage.css'

const { TextArea } = Input
const MIN_HIDE_REASON = 10

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

export function AdminReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [review, setReview] = useState<AdminReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hideReason, setHideReason] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await adminApi.getAdminReviewById(id)
      setReview(res.data)
      setHideReason('')
    } catch (err) {
      message.error(formatApiMessage(err))
      setReview(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    void load()
  }, [load])

  const handleHide = async () => {
    if (!id) return
    const reason = hideReason.trim()
    if (reason.length < MIN_HIDE_REASON) {
      message.warning(`Reason must be at least ${MIN_HIDE_REASON} characters`)
      return
    }
    setSubmitting(true)
    try {
      await adminApi.hideReview(id, { reason })
      message.success('Review hidden')
      await load()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRestore = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await adminApi.restoreReview(id)
      message.success('Review restored')
      await load()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await adminApi.deleteReview(id)
      message.success('Review deleted')
      navigate('/admin/reviews')
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setSubmitting(false)
      setDeleteModalOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-review-detail admin-review-detail--centered">
        <Spin size="large" />
      </div>
    )
  }

  if (!review || !id) {
    return (
      <div className="admin-review-detail admin-review-detail--centered">
        <p>Review not found.</p>
        <button
          type="button"
          className="admin-review-detail__link-btn"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    )
  }

  const isHidden = review.visibility === 'HIDDEN'
  const appointmentDate = dayjs(review.appointment.scheduledDate).format('D MMM YYYY')

  return (
    <div className="admin-review-detail">
      <header className="admin-review-detail__header">
        <button
          type="button"
          className="admin-review-detail__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="admin-review-detail__header-main">
          <h1 className="admin-review-detail__title">Review</h1>
          <span
            className="admin-review-detail__stars-lg"
            aria-label={`${review.rating} out of 5 stars`}
          >
            {renderStars(review.rating)}
          </span>
          <span className="admin-review-detail__visibility-wrap">
            {isHidden ? <EyeOff size={16} aria-hidden /> : null}
            <StatusBadge type="review" status={review.visibility} size="large" />
          </span>
        </div>
      </header>

      {isHidden ? (
        <div className="admin-review-detail__banner" role="alert">
          This review is currently hidden from the public.
        </div>
      ) : null}

      <section className="admin-review-detail__card">
        <h2 className="admin-review-detail__section-title">Parties</h2>
        <div className="admin-review-detail__parties">
          <div className="admin-review-detail__party">
            <span className="admin-review-detail__party-label">Client</span>
            <UserMiniCard
              name={formatPersonName(
                review.client.user.firstName,
                review.client.user.lastName,
              )}
              photo={review.client.imageUrl}
              role="Client"
            />
          </div>
          <div className="admin-review-detail__party">
            <span className="admin-review-detail__party-label">Provider</span>
            <UserMiniCard
              name={formatPersonName(
                review.provider.user.firstName,
                review.provider.user.lastName,
              )}
              photo={review.provider.photoUrl}
              role="Provider"
            />
            <p className="admin-review-detail__provider-stats">
              {formatRatingNumber(review.provider.averageRating)} ★ average ·{' '}
              {review.provider.totalReviews} total reviews
            </p>
          </div>
        </div>
      </section>

      <section className="admin-review-detail__card">
        <h2 className="admin-review-detail__section-title">Review content</h2>
        <p
          className="admin-review-detail__stars-xl"
          aria-label={`${review.rating} out of 5`}
        >
          {renderStars(review.rating)}
        </p>
        <p className="admin-review-detail__meta">
          Reviewed {formatDateTime(review.createdAt)} · Appointment on{' '}
          {appointmentDate}
          {' · '}
          <Link to={`/admin/appointments/${review.appointment.id}`}>
            View appointment
          </Link>
        </p>
        <blockquote className="admin-review-detail__comment">
          {review.comment?.trim() ? review.comment : 'No written comment'}
        </blockquote>
        {review.providerReply?.trim() ? (
          <div className="admin-review-detail__reply">
            <span className="admin-review-detail__reply-label">Provider reply:</span>
            <p>{review.providerReply}</p>
            <span className="admin-review-detail__reply-time">
              {formatDateTime(review.repliedAt)}
            </span>
          </div>
        ) : (
          <p className="admin-review-detail__muted">
            Provider has not replied to this review.
          </p>
        )}
      </section>

      {isHidden && review.hiddenReason ? (
        <section className="admin-review-detail__card admin-review-detail__hidden-card">
          <h2 className="admin-review-detail__section-title">Hidden status</h2>
          <p>
            <strong>Hidden reason:</strong> {review.hiddenReason}
          </p>
          <p className="admin-review-detail__muted">
            Hidden at: {formatDateTime(review.hiddenAt)}
          </p>
          <button
            type="button"
            className="admin-review-detail__btn admin-review-detail__btn--green admin-review-detail__btn--block"
            disabled={submitting}
            onClick={() => void handleRestore()}
          >
            Restore review
          </button>
        </section>
      ) : null}

      <section className="admin-review-detail__card">
        <h2 className="admin-review-detail__section-title">Admin actions</h2>
        {!isHidden ? (
          <div>
            <h3 className="admin-review-detail__subheading">Hide this review</h3>
            <label className="admin-review-detail__label" htmlFor="hide-reason">
              Reason (required, min {MIN_HIDE_REASON} characters)
            </label>
            <TextArea
              id="hide-reason"
              rows={4}
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              maxLength={2000}
              showCount
            />
            <button
              type="button"
              className="admin-review-detail__btn admin-review-detail__btn--red admin-review-detail__btn--block"
              disabled={submitting || hideReason.trim().length < MIN_HIDE_REASON}
              onClick={() => void handleHide()}
            >
              Hide review
            </button>
            <p className="admin-review-detail__warning">
              Hiding a review removes it from public listings and updates the
              provider&apos;s rating.
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="admin-review-detail__btn admin-review-detail__btn--green admin-review-detail__btn--block"
            disabled={submitting}
            onClick={() => void handleRestore()}
          >
            Restore review
          </button>
        )}
      </section>

      <section className="admin-review-detail__card admin-review-detail__danger">
        <h2 className="admin-review-detail__section-title admin-review-detail__danger-title">
          Permanently delete this review
        </h2>
        <p className="admin-review-detail__muted">
          This removes the review and updates provider and service ratings. This
          cannot be undone.
        </p>
        <button
          type="button"
          className="admin-review-detail__btn admin-review-detail__btn--outline-red"
          disabled={submitting}
          onClick={() => setDeleteModalOpen(true)}
        >
          Delete review
        </button>
      </section>

      <Modal
        title="Delete review permanently?"
        open={deleteModalOpen}
        onCancel={() => !submitting && setDeleteModalOpen(false)}
        onOk={() => void handleDelete()}
        okText="Delete permanently"
        okButtonProps={{ danger: true }}
        confirmLoading={submitting}
      >
        <p>
          This action cannot be undone. The review and all associated data will
          be permanently deleted.
        </p>
      </Modal>
    </div>
  )
}
