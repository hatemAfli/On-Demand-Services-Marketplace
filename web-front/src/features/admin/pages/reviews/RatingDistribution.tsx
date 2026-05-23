import type { ReviewStats } from '../../../../types/admin'
import './AdminReviewsPage.css'

const ROWS = [5, 4, 3, 2, 1] as const

const BAR_COLORS: Record<(typeof ROWS)[number], string> = {
  5: '#16a34a',
  4: '#86efac',
  3: '#f59e0b',
  2: '#fb923c',
  1: '#ef4444',
}

type RatingDistributionProps = {
  byRating: ReviewStats['byRating']
  total: number
}

export function RatingDistribution({ byRating, total }: RatingDistributionProps) {
  return (
    <section className="admin-reviews-page__distribution" aria-label="Rating distribution">
      <h2 className="admin-reviews-page__distribution-title">Rating distribution</h2>
      <div className="admin-reviews-page__distribution-rows">
        {ROWS.map((star) => {
          const count = byRating[star] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={star} className="admin-reviews-page__dist-row">
              <span className="admin-reviews-page__dist-label">{star}★</span>
              <div className="admin-reviews-page__dist-track">
                <div
                  className="admin-reviews-page__dist-bar"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: BAR_COLORS[star],
                  }}
                />
              </div>
              <span className="admin-reviews-page__dist-count">{count}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
