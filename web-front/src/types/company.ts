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
  updatedAt?: string
  respondedAt: string | null
  sentByAdmin?: {
    id: string
    user: { firstName: string; lastName: string; email: string }
  }
  provider: {
    id: string
    photoUrl: string | null
    city: string | null
    averageRating: number | string | null
    totalReviews?: number
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

// ─── Company services ──────────────────────────────────────────────────────────

export interface CompanyServiceGroup {
  serviceId: string
  serviceName: string
  categoryId: string
  categoryName: string
  coverImage: string | null
  activeProviders: number
  totalProviders: number
  averagePrice: number
  averageRating: number
  totalReviews: number
  totalCompletedJobs: number
}

export interface GivenServiceRow {
  id: string
  price: number
  pricingType: 'FIXED' | 'HOURLY'
  active: boolean
  averageRating: number
  totalReviews: number
  totalCompletedJobs: number
  description: string | null
  estimatedDurationMinutes: number | null
  galleries: { id: string; imageUrl: string }[]
  provider: {
    id: string
    photoUrl: string | null
    tagline: string | null
    user: { firstName: string; lastName: string; email: string; status: AccountStatus }
  }
}

export interface CompanyServiceDetail {
  serviceId: string
  serviceName: string
  categoryName: string
  givenServices: GivenServiceRow[]
}

export interface GivenServiceFull {
  id: string
  serviceId: string
  pricingType: 'FIXED' | 'HOURLY'
  price: number
  minimumHours: number | null
  estimatedDurationMinutes: number | null
  description: string | null
  whatIsIncluded: string | null
  whatIsNotIncluded: string | null
  toolsProvidedByProvider: boolean | null
  serviceAreaNotes: string | null
  advanceBookingRequiredHours: number | null
  serviceRadiusKm: number | null
  isAvailableImmediately: boolean | null
  clientMustProvide: string | null
  active: boolean
  averageRating: number
  totalReviews: number
  totalCompletedJobs: number
  galleries: { id: string; imageUrl: string }[]
  service: {
    id: string
    translations: { locale: string; name: string; description: string | null }[]
    category: { id: string; translations: { locale: string; name: string }[] }
  }
  provider: {
    id: string
    photoUrl: string | null
    tagline: string | null
    bio: string | null
    city: string
    yearsOfExperience: number | null
    languagesSpoken: string[]
    paymentMethodsAccepted: string[]
    user: { firstName: string; lastName: string; email: string; status: AccountStatus }
  }
}

export interface CategoryFilter {
  categoryId: string
  categoryName: string
  serviceCount: number
}

// ─── Company orders / appointments ──────────────────────────────────────────────

export type CompanyAppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REFUSED'
  | 'CANCELLED_CLIENT'
  | 'CANCELLED_PROVIDER'
  | 'DISPUTED'

export interface CompanyAppointment {
  id: string
  status: CompanyAppointmentStatus
  scheduledDate: string
  scheduledTime: string
  notes: string | null
  latitude: number | null
  longitude: number | null
  refusalReason: string | null
  rescheduleDate: string | null
  rescheduleTime: string | null
  createdAt: string
  confirmedAt: string | null
  providerId: string | null
  companyId: string | null
  client: {
    id: string
    user: {
      firstName: string
      lastName: string
      email: string
      phoneNumber?: string | null
    }
  } | null
  provider: {
    id: string
    photoUrl: string | null
    user: { firstName: string; lastName: string }
  } | null
  givenService: {
    id: string
    /** Prisma Decimal — serialized as string over JSON. */
    price: number | string | null
    pricingType?: 'FIXED' | 'HOURLY'
    estimatedDurationMinutes: number | null
    service: {
      translations: { name: string; language?: string; locale?: string }[]
      category: { translations: { name: string; language?: string; locale?: string }[] }
    }
  } | null
  complaints?: { id: string }[]
  review?: { id: string; rating: number } | null
}

export interface CompanyAppointmentsResponse {
  items: CompanyAppointment[]
  total: number
  skip: number
  take: number
}

export interface CompanyAppointmentStats {
  total: number
  byStatus: Record<string, number>
  todaysOrders: number
  pendingAssignment: number
  inProgress: number
  cancellationRate: number
  averageResponseTime: number | null
}

export interface CompanyRescheduleDayOption {
  date: string
  slots: string[]
}

export interface CompanyRescheduleOptionsResponse {
  options: CompanyRescheduleDayOption[]
  durationMinutes: number
}

export interface CompanyAvailableProvider {
  id: string
  displayName: string
  photoUrl: string | null
  city: string
  averageRating: number
  isTopProvider: boolean
  available: boolean
  isCurrentlyAssigned: boolean
}

export interface ListCompanyAppointmentsParams {
  status?: CompanyAppointmentStatus
  assignment?: 'ASSIGNED' | 'UNASSIGNED'
  from?: string
  to?: string
  search?: string
  skip?: number
  take?: number
}

export type CompanyRespondAction = 'CONFIRMED' | 'REFUSED' | 'RESCHEDULED'

export interface CompanyRespondPayload {
  action: CompanyRespondAction
  refusalReason?: string
  rescheduleDate?: string
  rescheduleTime?: string
}

// ─── Company schedule / capacity ───────────────────────────────────────────────

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export interface ProviderAvailabilityDay {
  id: string
  providerId: string
  dayOfWeek: DayOfWeek
  isWorking: boolean
  startTime: string
  endTime: string
}

export interface ProviderDayOff {
  id: string
  providerId: string
  date: string
  reason: string | null
  createdAt: string
}

export interface CompanyScheduleAppointment {
  id: string
  status: string
  scheduledTime: string
  durationMinutes: number
  serviceName: string
  clientName: string
  startMinutes: number
  endMinutes: number
}

export interface CompanyScheduleEmployee {
  id: string
  displayName: string
  photoUrl: string | null
  city: string
  isWorkingToday: boolean
  isDayOff: boolean
  dayOffReason: string | null
  workingHours: { start: string; end: string } | null
  loadPct: number
  hasConflict: boolean
  appointments: CompanyScheduleAppointment[]
}

export interface CompanyScheduleConflict {
  providerId: string
  providerName: string
  date: string
  appointments: Array<{
    id: string
    serviceName: string
    scheduledTime: string
    durationMinutes: number
  }>
}

export interface CompanyDaySchedule {
  date: string
  dayOfWeek: DayOfWeek
  gridStart: string
  gridEnd: string
  hours: string[]
  employees: CompanyScheduleEmployee[]
  stats: {
    totalEmployees: number
    workingToday: number
    onDayOff: number
    offSchedule: number
    conflictCount: number
  }
  conflicts: CompanyScheduleConflict[]
}

export interface UpsertAvailabilityPayload {
  days: Array<{
    dayOfWeek: DayOfWeek
    isWorking: boolean
    startTime: string
    endTime: string
  }>
}

// ─── Company reviews ─────────────────────────────────────────────────────────────

export interface CompanyReviewStats {
  companyName: string
  companyAverageRating: number
  employeeCount: number
  totalReviews: number
  reviewCount: number
  averageReviewRating: number
  responseRate: number
  withReply: number
  lowRatingCount: number
  byRating: Record<number, number>
  monthlyChange: number
}

export interface CompanyReviewBreakdownRow {
  star: number
  count: number
  percentage: number
}

export interface CompanyReviewByService {
  serviceId: string
  serviceName: string
  reviewCount: number
  averageRating: number
}

export interface CompanyReviewTrendPoint {
  week: string
  label: string
  rating: number
  count: number
}

export interface CompanyTopRatedProvider {
  id: string
  displayName: string
  photoUrl: string | null
  averageRating: number
  totalReviews: number
  completedJobs: number
  isTopProvider: boolean
}

export interface CompanyReview {
  id: string
  rating: number
  comment: string | null
  providerReply: string | null
  repliedAt: string | null
  createdAt: string
  client: {
    imageUrl: string | null
    user: { firstName: string; lastName: string }
  }
  provider: {
    id: string
    photoUrl: string | null
    user: { firstName: string; lastName: string }
  } | null
  givenService: {
    serviceId?: string
    service: {
      translations: { name: string }[]
      category?: { translations: { name: string }[] }
    }
  }
  appointment: {
    id: string
    scheduledDate: string
    scheduledTime: string
  } | null
}

export interface CompanyReviewsResponse {
  items: CompanyReview[]
  total: number
  skip: number
  take: number
}

export interface ListCompanyReviewsParams {
  providerId?: string
  serviceId?: string
  minRating?: number
  maxRating?: number
  sort?: 'recent' | 'oldest' | 'highest' | 'lowest'
  take?: number
  skip?: number
}

// ─── Company settings ────────────────────────────────────────────────────────────

export type CompanyBranchStatus = 'OPERATIONAL' | 'COMING_SOON' | 'INACTIVE'

export interface CompanySettingsProfile {
  companyName: string
  taxId: string
  email: string
  phone: string
  city: string
  address: string
  about: string
  serviceZones: string[]
  logo: string | null
}

export interface CompanyBranch {
  id: string
  name: string
  subtitle: string | null
  city: string
  address: string | null
  status: CompanyBranchStatus
  statusLabel: string
  activeProviders: number
  createdAt: string
  updatedAt: string
}

export interface CompanyAuditLogEntry {
  id: string
  action: string
  summary: string
  actorName: string
  ipAddress: string | null
  createdAt: string
  displayId: string
}

export interface CompanySettingsResponse {
  profile: CompanySettingsProfile
  branches: CompanyBranch[]
  auditPreview: CompanyAuditLogEntry[]
}

export interface CompanyAuditLogsResponse {
  items: CompanyAuditLogEntry[]
  total: number
  skip: number
  take: number
}

export interface UpsertCompanyBranchPayload {
  name: string
  subtitle?: string
  city: string
  address?: string
  status?: CompanyBranchStatus
}

export type CompanyComplaintStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'WITHDRAWN'

export type CompanyComplaintCategory =
  | 'SERVICE_QUALITY'
  | 'NO_SHOW'
  | 'LATE_ARRIVAL'
  | 'UNPROFESSIONAL'
  | 'OVERCHARGING'
  | 'PROPERTY_DAMAGE'
  | 'SAFETY_CONCERN'
  | 'FRAUD'
  | 'OTHER'

export type ComplaintForwardTarget = 'PLATFORM' | 'COMPANY' | 'BOTH'

export interface CompanyComplaintStats {
  total: number
  open: number
  underReview: number
  resolvedThisMonth: number
}

export interface CompanyComplaintListItem {
  id: string
  category: CompanyComplaintCategory
  status: CompanyComplaintStatus
  description: string
  evidenceUrls: string[]
  forwardTarget: ComplaintForwardTarget
  targetIsEmployee: boolean
  adminResponse: string | null
  companyResponse: string | null
  companyNotes: string | null
  openedAt: string
  createdAt: string
  reviewedAt: string | null
  resolvedAt: string | null
  companyReviewedAt: string | null
  client: {
    imageUrl: string | null
    user: { firstName: string; lastName: string; email: string }
  }
  provider: {
    photoUrl: string | null
    user: { firstName: string; lastName: string }
  }
  appointment: {
    id: string
    scheduledDate: string
    scheduledTime: string
    serviceName: string
  }
}

export interface CompanyComplaintsResponse {
  items: CompanyComplaintListItem[]
  total: number
}

export interface ListCompanyComplaintsParams {
  status?: CompanyComplaintStatus
  category?: CompanyComplaintCategory
  sort?: 'recent' | 'oldest'
  take?: number
  skip?: number
}

export interface ReviewCompanyComplaintPayload {
  status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED'
  companyNotes?: string
  companyResponse?: string
}

// ─── Company dashboard ───────────────────────────────────────────────────────────

export interface CompanyDashboardTrendPoint {
  date: string
  label: string
  orders: number
}

export interface CompanyDashboardRevenuePoint {
  date: string
  label: string
  amount: number
}

export interface CompanyDashboardLiveOrder {
  id: string
  shortId: string
  status: CompanyAppointmentStatus
  scheduledDate: string
  scheduledTime: string
  serviceName: string
  clientName: string
  providerId: string | null
  providerName: string | null
  providerPhotoUrl: string | null
  needsAssignment: boolean
  hasComplaint: boolean
}

export interface CompanyDashboardTopProvider {
  id: string
  displayName: string
  photoUrl: string | null
  averageRating: number
  totalReviews: number
  completedJobs: number
  isTopProvider: boolean
  rank: number
}

export interface CompanyDashboardActivity {
  id: string
  action: string
  summary: string
  actorName: string
  createdAt: string
}

export interface CompanyDashboardAlert {
  id: string
  tone: 'urgent' | 'info' | 'neutral'
  title: string
  message: string
  path: string
}

export interface CompanyDashboardData {
  company: {
    companyName: string
    logo: string | null
    averageRating: number
    totalReviews: number
    cancellationRate: number
    averageResponseTime: number | null
  }
  orders: {
    today: number
    yesterday: number
    trendPct: number | null
    todayCompleted: number
    todayPending: number
    inProgress: number
    pendingAssignment: number
    disputed: number
    activeLive: number
  }
  team: {
    employeeCount: number
    activeServices: number
  }
  ratings: {
    averageRating: number
    totalReviews: number
  }
  complaints: {
    open: number
    underReview: number
    total: number
  }
  ordersTrend: CompanyDashboardTrendPoint[]
  revenueTrend: CompanyDashboardRevenuePoint[]
  todayRevenue: number
  liveOrders: CompanyDashboardLiveOrder[]
  topProviders: CompanyDashboardTopProvider[]
  activity: CompanyDashboardActivity[]
  alerts: CompanyDashboardAlert[]
  generatedAt: string
}
