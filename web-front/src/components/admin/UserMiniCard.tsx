import './admin-components.css'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export type UserMiniCardProps = {
  name: string
  email?: string
  photo?: string | null
  role?: string
  city?: string
  extraBadge?: string
  badgeClassName?: string
}

export function UserMiniCard({
  name,
  email,
  photo,
  role,
  city,
  extraBadge,
  badgeClassName,
}: UserMiniCardProps) {
  return (
    <div className="admin-user-mini">
      {photo ? (
        <img className="admin-user-mini__avatar" src={photo} alt="" />
      ) : (
        <div className="admin-user-mini__avatar" aria-hidden>
          {initials(name)}
        </div>
      )}
      <div className="admin-user-mini__body">
        <div className="admin-user-mini__name">{name}</div>
        {email ? <div className="admin-user-mini__email">{email}</div> : null}
        {(role || city || extraBadge) && (
          <div className="admin-user-mini__meta">
            {role ? <span className="admin-user-mini__chip">{role}</span> : null}
            {city ? <span className="admin-user-mini__chip">{city}</span> : null}
            {extraBadge ? (
              <span
                className={`admin-user-mini__badge${badgeClassName ? ` ${badgeClassName}` : ''}`}
              >
                {extraBadge}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}