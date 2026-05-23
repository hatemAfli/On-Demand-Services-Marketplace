import {
  EyeOff,
  MessageCircle,
  Star,
  TrendingUp,
} from 'lucide-react'
import { App as AntdApp, Input, Modal } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DataTable,
  FilterBar,
  StatsCard,
  StatusBadge,
  UserMiniCard,
} from '../../../../components/admin'
import type { DataTableColumn } from '../../../../components/admin'
import { adminApi } from '../../../../services/adminApi'
import type { GetAdminReviewsParams } from '../../../../services/adminApi'
import type { AdminReview, ReviewStats, ReviewVisibility } from '../../../../types/admin'
import { RatingDistribution } from './RatingDistribution'
import {
  formatPersonName,
  formatRatingNumber,
  pickServiceName,
  renderStars,
  truncateComment,
} from './reviewUtils'
import './AdminReviewsPage.css'

const { TextArea } = Input
const PAGE_SIZE = 20

const DEFAULT_FILTERS: Record<string, string> = {
  visibility: '',
  rating: '',
  sort: 'recent',
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function buildQueryParams(
  filters: Record<string, string>,
  page: number,
): GetAdminReviewsParams {
  const params: GetAdminReviewsParams = {
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  }
  if (filters.visibility === 'PUBLIC' || filters.visibility === 'HIDDEN') {
    params.visibility = filters.visibility as ReviewVisibility
  }
  if (filters.rating) {
    const r = Number(filters.rating)
    if (r >= 1 && r <= 5) {
      params.minRating = r
      params.maxRating = r
    }
  }
  const sort = filters.sort
  if (
    sort === 'recent' ||
    sort === 'oldest' ||
    sort === 'highest' ||
    sort === 'lowest'
  ) {
    params.sort = sort
  }
  return params
}

export function AdminReviewsPage() {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [hideId, setHideId] = useState<string | null>(null)
  const [hideReason, setHideReason] = useState('')
  const [hideSubmitting, setHideSubmitting] = useState(false)
  const [rowActionId, setRowActionId] = useState<string | null>(null)

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.getAdminReviews(buildQueryParams(filters, page))
      setReviews(res.data.items)
      setTotal(res.data.total)
    } catch (err) {
      setError(formatApiMessage(err))
      setReviews([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  const loadStats = useCallback(async () => {
    try {
      const res = await adminApi.getReviewStats()
      setStats(res.data)
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStats(), loadReviews()])
  }, [loadStats, loadReviews])

  const openDetail = useCallback(
    (row: AdminReview) => {
      navigate(`/admin/reviews/${row.id}`)
    },
    [navigate],
  )

  const handleRestore = useCallback(
    async (reviewId: string) => {
      setRowActionId(reviewId)
      try {
        await adminApi.restoreReview(reviewId)
        message.success('Review restored')
        await refreshAll()
      } catch (err) {
        message.error(formatApiMessage(err))
      } finally {
        setRowActionId(null)
      }
    },
    [message, refreshAll],
  )

  const handleHideConfirm = async () => {
    if (!hideId) return
    const reason = hideReason.trim()
    if (reason.length < 10) {
      message.warning('Reason must be at least 10 characters')
      return
    }
    setHideSubmitting(true)
    try {
      await adminApi.hideReview(hideId, { reason })
      message.success('Review hidden')
      setHideId(null)
      setHideReason('')
      await refreshAll()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setHideSubmitting(false)
    }
  }

  const filterConfig = useMemo(
    () => [
      {
        key: 'visibility',
        label: 'Visibility',
        type: 'select' as const,
        options: [
          { value: '', label: 'All' },
          { value: 'PUBLIC', label: 'Public only' },
          { value: 'HIDDEN', label: 'Hidden only' },
        ],
      },
      {
        key: 'rating',
        label: 'Rating',
        type: 'select' as const,
        options: [
          { value: '', label: 'All' },
          { value: '5', label: '5★' },
          { value: '4', label: '4★' },
          { value: '3', label: '3★' },
          { value: '2', label: '2★' },
          { value: '1', label: '1★' },
        ],
      },
      {
        key: 'sort',
        label: 'Sort',
        type: 'select' as const,
        options: [
          { value: 'recent', label: 'Most recent' },
          { value: 'oldest', label: 'Oldest' },
          { value: 'highest', label: 'Highest rating' },
          { value: 'lowest', label: 'Lowest rating' },
        ],
      },
    ],
    [],
  )

  const columns = useMemo<DataTableColumn<AdminReview>[]>(
    () => [
      {
        key: 'client',
        label: 'Client',
        width: '14%',
        render: (row) => (
          <UserMiniCard
            name={formatPersonName(
              row.client.user.firstName,
              row.client.user.lastName,
            )}
            photo={row.client.imageUrl}
          />
        ),
      },
      {
        key: 'provider',
        label: 'Provider',
        width: '14%',
        render: (row) => (
          <div>
            <UserMiniCard
              name={formatPersonName(
                row.provider.user.firstName,
                row.provider.user.lastName,
              )}
              photo={row.provider.photoUrl}
            />
            <span className="admin-reviews-page__provider-rating">
              {formatRatingNumber(row.provider.averageRating)} ★ ·{' '}
              {row.provider.totalReviews} reviews
            </span>
          </div>
        ),
      },
      {
        key: 'service',
        label: 'Service',
        width: '12%',
        render: (row) => pickServiceName(row),
      },
      {
        key: 'rating',
        label: 'Rating',
        width: '10%',
        render: (row) => (
          <span className="admin-reviews-page__stars" aria-label={`${row.rating} stars`}>
            {renderStars(row.rating)}
          </span>
        ),
      },
      {
        key: 'comment',
        label: 'Comment',
        width: '14%',
        render: (row) => (
          <span className="admin-reviews-page__comment" title={row.comment ?? undefined}>
            {truncateComment(row.comment)}
          </span>
        ),
      },
      {
        key: 'reply',
        label: 'Reply',
        width: '9%',
        render: (row) =>
          row.providerReply?.trim() ? (
            <span className="admin-reviews-page__reply-yes">✓ Replied</span>
          ) : (
            <span className="admin-reviews-page__reply-no">No reply</span>
          ),
      },
      {
        key: 'visibility',
        label: 'Visibility',
        width: '10%',
        render: (row) => (
          <span className="admin-reviews-page__visibility">
            {row.visibility === 'HIDDEN' ? (
              <EyeOff size={14} aria-hidden />
            ) : null}
            <StatusBadge type="review" status={row.visibility} />
          </span>
        ),
      },
      {
        key: 'date',
        label: 'Date',
        width: '9%',
        render: (row) => {
          const d = dayjs(row.createdAt)
          return d.isValid() ? d.format('D MMM YYYY') : '—'
        },
      },
      {
        key: 'actions',
        label: '',
        width: '12%',
        render: (row) => (
          <div className="admin-reviews-page__actions">
            <button
              type="button"
              className="admin-table-action"
              onClick={(e) => {
                e.stopPropagation()
                openDetail(row)
              }}
            >
              View →
            </button>
            {row.visibility === 'PUBLIC' ? (
              <button
                type="button"
                className="admin-reviews-page__btn-sm admin-reviews-page__btn-sm--hide"
                disabled={rowActionId === row.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setHideId(row.id)
                  setHideReason('')
                }}
              >
                Hide
              </button>
            ) : (
              <button
                type="button"
                className="admin-reviews-page__btn-sm admin-reviews-page__btn-sm--restore"
                disabled={rowActionId === row.id}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleRestore(row.id)
                }}
              >
                Restore
              </button>
            )}
          </div>
        ),
      },
    ],
    [openDetail, rowActionId, handleRestore],
  )

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const avgDisplay = stats
    ? `${formatRatingNumber(stats.averageRating)} ★`
    : '—'

  return (
    <div className="admin-reviews-page">
      <h1 className="admin-page-title">Reviews &amp; Ratings</h1>

      <section className="admin-stats-grid" aria-label="Review statistics">
        <StatsCard
          title="Total reviews"
          value={stats?.total ?? '—'}
          icon={Star}
          color="#d97706"
        />
        <StatsCard
          title="Average rating"
          value={avgDisplay}
          icon={TrendingUp}
          color="#16a34a"
        />
        <StatsCard
          title="Hidden reviews"
          value={stats?.hidden ?? '—'}
          icon={EyeOff}
          color="#dc2626"
        />
        <StatsCard
          title="With provider reply"
          value={stats?.withReply ?? '—'}
          icon={MessageCircle}
          color="#2563eb"
        />
      </section>

      {stats ? (
        <RatingDistribution byRating={stats.byRating} total={stats.total} />
      ) : null}

      <FilterBar
        filters={filterConfig}
        values={filters}
        onChange={(key, value) => {
          setFilters((prev) => ({ ...prev, [key]: value }))
          setPage(1)
        }}
        onReset={() => {
          setFilters(DEFAULT_FILTERS)
          setPage(1)
        }}
      />

      {error ? (
        <p className="admin-reviews-page__error" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={reviews}
        loading={loading}
        onRowClick={openDetail}
        emptyMessage="No reviews match your filters"
      />

      <div className="admin-pagination">
        <span>
          Showing {rangeStart}–{rangeEnd} of {total} reviews
        </span>
        <div className="admin-pagination__actions">
          <button
            type="button"
            className="admin-pagination__btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="admin-pagination__btn"
            disabled={page >= totalPages || loading || total === 0}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <Modal
        title="Hide review"
        open={hideId != null}
        onCancel={() => !hideSubmitting && setHideId(null)}
        onOk={() => void handleHideConfirm()}
        okText="Hide review"
        okButtonProps={{ danger: true }}
        confirmLoading={hideSubmitting}
      >
        <p style={{ marginBottom: 12, fontSize: 13, color: '#595959' }}>
          Provide a reason (visible internally). Minimum 10 characters.
        </p>
        <TextArea
          rows={3}
          value={hideReason}
          onChange={(e) => setHideReason(e.target.value)}
          placeholder="Reason for hiding this review…"
          maxLength={2000}
          showCount
        />
      </Modal>
    </div>
  )
}
