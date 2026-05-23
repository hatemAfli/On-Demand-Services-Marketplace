import type { LucideIcon } from 'lucide-react'
import './admin-components.css'

export type StatsCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color: string
  trend?: { value: number; label: string }
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: StatsCardProps) {
  const trendUp = trend != null && trend.value >= 0

  return (
    <article className="admin-stats-card">
      <div
        className="admin-stats-card__icon"
        style={{ backgroundColor: `${color}18`, color }}
      >
        <Icon size={22} strokeWidth={2} />
      </div>
      <div>
        <p className="admin-stats-card__value">{value}</p>
        <p className="admin-stats-card__title">{title}</p>
        {subtitle ? <p className="admin-stats-card__subtitle">{subtitle}</p> : null}
        {trend ? (
          <span
            className={`admin-stats-card__trend ${
              trendUp ? 'admin-stats-card__trend--up' : 'admin-stats-card__trend--down'
            }`}
          >
            {trendUp ? '+' : ''}
            {trend.value}% {trend.label}
          </span>
        ) : null}
      </div>
    </article>
  )
}
