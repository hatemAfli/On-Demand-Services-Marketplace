import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { App as AntdApp, Input, Segmented, Spin } from 'antd'
import { AxiosError } from 'axios'
import { FaArrowLeft } from 'react-icons/fa6'
import companyApi from '../../../../services/companyApi'
import type {
  CompanyComplaintListItem,
  CompanyComplaintStatus,
} from '../../../../types/company'
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  FORWARD_TARGET_LABELS,
  formatPersonName,
} from './complaintMeta'
import './CompanyComplaintsPage.css'

const { TextArea } = Input

type ReviewStatus = 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED'

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg[0] ?? fallback
    if (typeof msg === 'string') return msg
  }
  return fallback
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

function isEditable(status: CompanyComplaintStatus): boolean {
  return status === 'OPEN' || status === 'UNDER_REVIEW'
}

export function CompanyComplaintDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [complaint, setComplaint] = useState<CompanyComplaintListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('UNDER_REVIEW')
  const [companyNotes, setCompanyNotes] = useState('')
  const [companyResponse, setCompanyResponse] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await companyApi.getCompanyComplaintById(id)
      setComplaint(data)
      const nextReview: ReviewStatus =
        data.status === 'RESOLVED' || data.status === 'DISMISSED'
          ? data.status
          : 'UNDER_REVIEW'
      setReviewStatus(nextReview)
      setCompanyNotes(data.companyNotes ?? '')
      setCompanyResponse(data.companyResponse ?? '')
    } catch (err) {
      message.error(errorMessage(err, 'Could not load complaint'))
      setComplaint(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    void load()
  }, [load])

  const canSubmit = useMemo(() => {
    if (!complaint || !isEditable(complaint.status)) return false
    return !!reviewStatus
  }, [complaint, reviewStatus])

  const submitReview = async () => {
    if (!id || !canSubmit) return
    setSubmitting(true)
    try {
      await companyApi.reviewCompanyComplaint(id, {
        status: reviewStatus,
        companyNotes: companyNotes.trim() || undefined,
        companyResponse: companyResponse.trim() || undefined,
      })
      message.success('Complaint updated')
      await load()
    } catch (err) {
      message.error(errorMessage(err, 'Could not save review'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="cp-root" style={{ alignItems: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="cp-root">
        <Link to="/company/complaints" className="cp-page-btn" style={{ width: 'fit-content' }}>
          <FaArrowLeft /> Back to complaints
        </Link>
        <p>Complaint not found.</p>
      </div>
    )
  }

  const editable = isEditable(complaint.status)

  return (
    <div className="cp-root">
      <button
        type="button"
        className="cp-page-btn"
        onClick={() => navigate('/company/complaints')}
        style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <FaArrowLeft /> Back to complaints
      </button>

      <h1 className="cp-page-title">Complaint review</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}
      >
        <section className="cp-kpi-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <span className={`cp-badge ${complaint.status === 'OPEN' ? 'cp-badge-open' : 'cp-badge-review'}`}>
              {COMPLAINT_STATUS_LABELS[complaint.status]}
            </span>
            <span className="cp-badge cp-badge-forward">
              {FORWARD_TARGET_LABELS[complaint.forwardTarget]}
            </span>
            <span style={{ color: '#64748b', fontSize: 14 }}>
              {COMPLAINT_CATEGORY_LABELS[complaint.category]} · Filed{' '}
              {formatDateTime(complaint.openedAt ?? complaint.createdAt)}
            </span>
          </div>
        </section>

        <section className="cp-kpi-card">
          <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>Client</h4>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {formatPersonName(
              complaint.client.user.firstName,
              complaint.client.user.lastName,
            )}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {complaint.client.user.email}
          </p>
        </section>

        <section className="cp-kpi-card">
          <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>Provider</h4>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {formatPersonName(
              complaint.provider.user.firstName,
              complaint.provider.user.lastName,
            )}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {complaint.appointment.serviceName} · {complaint.appointment.scheduledDate}{' '}
            {complaint.appointment.scheduledTime}
          </p>
        </section>

        <section className="cp-kpi-card" style={{ gridColumn: '1 / -1' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>Description</h4>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {complaint.description}
          </p>
        </section>

        {complaint.evidenceUrls.length > 0 ? (
          <section className="cp-kpi-card" style={{ gridColumn: '1 / -1' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b' }}>Evidence</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {complaint.evidenceUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block' }}
                >
                  <img
                    src={url}
                    alt="Evidence"
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                    }}
                  />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {complaint.adminResponse ? (
          <section className="cp-kpi-card" style={{ gridColumn: '1 / -1' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>
              Platform response
            </h4>
            <p style={{ margin: 0 }}>{complaint.adminResponse}</p>
          </section>
        ) : null}

        {editable ? (
          <section className="cp-kpi-card" style={{ gridColumn: '1 / -1' }}>
            <h4 style={{ margin: '0 0 16px' }}>Your review</h4>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                Status
              </label>
              <Segmented
                value={reviewStatus}
                onChange={(v) => setReviewStatus(v as ReviewStatus)}
                options={[
                  { label: 'Under review', value: 'UNDER_REVIEW' },
                  { label: 'Resolved', value: 'RESOLVED' },
                  { label: 'Dismissed', value: 'DISMISSED' },
                ]}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                Internal notes (not shown to client)
              </label>
              <TextArea
                rows={3}
                value={companyNotes}
                onChange={(e) => setCompanyNotes(e.target.value)}
                placeholder="Notes for your team…"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                Response to client
              </label>
              <TextArea
                rows={4}
                value={companyResponse}
                onChange={(e) => setCompanyResponse(e.target.value)}
                placeholder="Explain what action you took…"
              />
            </div>
            <button
              type="button"
              className="cp-action-btn"
              disabled={!canSubmit || submitting}
              onClick={() => void submitReview()}
            >
              {submitting ? 'Saving…' : 'Save review'}
            </button>
          </section>
        ) : (
          <section className="cp-kpi-card" style={{ gridColumn: '1 / -1' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>
              Company response
            </h4>
            <p style={{ margin: 0 }}>
              {complaint.companyResponse ?? '—'}
            </p>
            {complaint.companyReviewedAt ? (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
                Reviewed {formatDateTime(complaint.companyReviewedAt)}
              </p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  )
}
