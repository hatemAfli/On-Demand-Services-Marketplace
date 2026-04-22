export type UserRole =
  | 'CLIENT'
  | 'PROVIDER'
  | 'COMPANY_ADMIN'
  | 'PLATFORM_ADMIN'

export type WebAllowedRole = 'COMPANY_ADMIN' | 'PLATFORM_ADMIN'

export type AccountStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DELETED'

/** Subset of GET /auth/me used by web dashboards */
export type WebConsoleUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  status: AccountStatus
}

export function isWebAllowedRole(role: UserRole): role is WebAllowedRole {
  return role === 'PLATFORM_ADMIN' || role === 'COMPANY_ADMIN'
}
