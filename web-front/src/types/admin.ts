// Admin dashboard types aligned with backend Prisma models and admin API payloads.

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REFUSED'
  | 'RESCHEDULED'
  | 'CANCELLED_CLIENT'
  | 'CANCELLED_PROVIDER'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISPUTED'

export type ComplaintStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'WITHDRAWN'

export type ComplaintCategory =
  | 'SERVICE_QUALITY'
  | 'NO_SHOW'
  | 'LATE_ARRIVAL'
  | 'UNPROFESSIONAL'
  | 'OVERCHARGING'
  | 'PROPERTY_DAMAGE'
  | 'SAFETY_CONCERN'
  | 'FRAUD'
  | 'OTHER'

export type ComplaintDecision =
  | 'WARNING_ISSUED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_BANNED'
  | 'REFUND_ISSUED'
  | 'NO_ACTION'
  | 'FORWARDED_TO_COMPANY'

export type ReviewVisibility = 'PUBLIC' | 'HIDDEN'

/** Matches Prisma `ProviderType` when returned as JSON. */
export type ProviderType = 'INDEPENDENT' | 'EMPLOYEE'

export interface AdminAppointment {
  id: string
  status: AppointmentStatus
  scheduledDate: string
  scheduledTime: string
  notes: string | null
  durationMinutes: number | null
  cancelledBy: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  enRouteAt: string | null
  startedAt: string | null
  completedAt: string | null
  client: {
    id: string
    imageUrl: string | null
    user: { firstName: string; lastName: string; email: string }
  }
  provider: {
    id: string
    photoUrl: string | null
    type: ProviderType | string
    city: string
    totalComplaints: number
    user: { firstName: string; lastName: string; email: string }
  }
  givenService: {
    id: string
    price: number
    pricingType: string
    service: { translations: { locale: string; name: string }[] }
  }
  review: { id: string; rating: number; comment: string | null } | null
  complaints: { id: string; status: ComplaintStatus; category: ComplaintCategory }[]
}

export interface AdminComplaint {
  id: string
  category: ComplaintCategory
  description: string
  evidenceUrls: string[]
  status: ComplaintStatus
  decision: ComplaintDecision | null
  adminNotes: string | null
  adminResponse: string | null
  targetIsEmployee: boolean
  openedAt: string
  reviewedAt: string | null
  resolvedAt: string | null
  createdAt: string
  client: {
    id: string
    imageUrl: string | null
    user: { firstName: string; lastName: string; email: string }
  }
  provider: {
    id: string
    photoUrl: string | null
    type: ProviderType | string
    city: string
    totalComplaints: number
    activeComplaints: number
    user: { firstName: string; lastName: string; email: string }
  }
  appointment: {
    id: string
    scheduledDate: string
    scheduledTime: string
    givenService: {
      service: { translations: { locale: string; name: string }[] }
    }
  }
  handledByAdmin: {
    id: string
    user: { firstName: string; lastName: string }
  } | null
}

export interface AdminReview {
  id: string
  rating: number
  comment: string | null
  providerReply: string | null
  repliedAt: string | null
  visibility: ReviewVisibility
  hiddenReason: string | null
  hiddenAt: string | null
  createdAt: string
  client: {
    id: string
    imageUrl: string | null
    user: { firstName: string; lastName: string }
  }
  provider: {
    id: string
    photoUrl: string | null
    averageRating: number
    totalReviews: number
    user: { firstName: string; lastName: string }
  }
  givenService: {
    id: string
    service: { translations: { locale: string; name: string }[] }
  }
  appointment: { id: string; scheduledDate: string }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  take: number
}

export interface AppointmentStats {
  total: number
  byStatus: Record<AppointmentStatus, number>
  completedToday: number
  disputedActive: number
  averageDurationMinutes: number
}

export interface ComplaintStats {
  total: number
  open: number
  underReview: number
  resolvedThisMonth: number
  byCategory: Record<ComplaintCategory, number>
}

export interface ReviewStats {
  total: number
  averageRating: number
  hidden: number
  withReply: number
  byRating: Record<1 | 2 | 3 | 4 | 5, number>
}
