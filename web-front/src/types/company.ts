import type { AccountStatus } from './user'

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface CompanyEmployeeUser {
  firstName: string
  lastName: string
  email: string
  status: AccountStatus
  createdAt?: string
}

/** Row returned by GET /company/employees (a Provider + included relations). */
export interface CompanyEmployee {
  id: string
  photoUrl: string | null
  city: string | null
  /** Prisma Decimal — serialized as string over JSON. */
  averageRating: number | string | null
  totalReviews: number
  createdAt?: string
  user: CompanyEmployeeUser
  availability?: { isWorking: boolean; dayOfWeek: string }[]
  _count?: { appointments?: number; reviews?: number }
}

export interface CompanyEmployeesResponse {
  items: CompanyEmployee[]
  total: number
}

/** Result of GET /company/employees/lookup?email=… */
export interface ProviderLookupResult {
  id: string
  userId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  city: string | null
  averageRating: number | string | null
  totalReviews: number
  type: string
  companyId: string | null
  isTopProvider: boolean
}

export interface InvitationRow {
  id: string
  status: InvitationStatus
  message: string | null
  expiresAt: string
  createdAt: string
  respondedAt: string | null
  provider: {
    id: string
    photoUrl: string | null
    city: string | null
    averageRating: number | string | null
    user: { firstName: string; lastName: string; email: string }
  }
}

export interface EmployeeAppointmentItem {
  id: string
  status: string
  scheduledDate?: string | null
  scheduledTime?: string | null
  createdAt?: string | null
  client?: { user?: { firstName?: string; lastName?: string } } | null
  givenService?: {
    service?: {
      name?: string | null
      translations?: { name: string; language?: string }[]
    } | null
  } | null
}

/** Detailed employee returned by GET /company/employees/:providerId. */
export interface EmployeeDetail extends CompanyEmployee {
  user: CompanyEmployeeUser & { phoneNumber?: string | null }
  appointments?: EmployeeAppointmentItem[]
  reviews?: unknown[]
  daysOff?: unknown[]
  _count?: { appointments?: number; reviews?: number }
}
