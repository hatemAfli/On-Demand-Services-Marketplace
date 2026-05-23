import type { AccountStatus, UserRole } from './user'

export type AdminUserStats = {
  appointments?: number
  reviews?: number
  complaints?: number
  givenServices?: number
}

export type AdminUserClientProfile = {
  id: string
  city: string
  address: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export type AdminUserCompanySummary = {
  id: string
  companyName: string
  taxId: string
  city: string
  address: string | null
  email: string | null
  logo: string | null
  averageRating: number | null
  totalReviews: number
}

export type AdminUserProviderProfile = {
  id: string
  type: string
  city: string
  address: string | null
  latitude: number | null
  longitude: number | null
  photoUrl: string | null
  tagline: string | null
  bio: string | null
  yearsOfExperience: number | null
  languagesSpoken: string[]
  gender: string | null
  totalReviews: number
  averageRating: number | null
  cancellationRate: number | null
  isTopProvider: boolean
  paymentMethodsAccepted: string[]
  companyId: string | null
  totalComplaints: number
  activeComplaints: number
  company: AdminUserCompanySummary | null
  createdAt: string
  updatedAt: string
}

export type AdminUserCompanyEmployee = {
  id: string
  type: string
  city: string
  photoUrl: string | null
  user: {
    firstName: string
    lastName: string
    email: string
    status: AccountStatus
  }
}

export type AdminUserCompanyAdminProfile = {
  id: string
  companyId: string
  company: (AdminUserCompanySummary & {
    providers: AdminUserCompanyEmployee[]
  }) | null
  createdAt: string
  updatedAt: string
}

export type AdminUserPlatformAdminProfile = {
  id: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export type AdminUserVerificationDocument = {
  id: string
  type: string
  fichierUrl: string
  uploadedAt: string
  validatedAt: string | null
  isAccepted: boolean | null
  rejectionReason: string | null
}

export type AdminUserVerificationRequest = {
  id: string
  ownerType: string
  requestStatus: string
  adminComment: string | null
  ownerComment: string | null
  createdAt: string
  updatedAt: string
  service: { id: string; name: string; categorySlug: string | null } | null
  documents: AdminUserVerificationDocument[]
}

export type AdminUserGivenService = {
  id: string
  price: number
  pricingType: string
  active: boolean
  averageRating: number | null
  totalReviews: number | null
  totalCompletedJobs: number | null
  createdAt: string
  serviceName: string
  categoryName: string | null
}

export type AdminUserDetail = {
  id: string
  email: string
  phoneNumber: string | null
  firstName: string
  lastName: string
  role: UserRole
  status: AccountStatus
  isEmailVerified: boolean
  isPhoneVerified: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  stats: AdminUserStats
  client: AdminUserClientProfile | null
  provider: AdminUserProviderProfile | null
  companyAdmin: AdminUserCompanyAdminProfile | null
  platformAdmin: AdminUserPlatformAdminProfile | null
  verificationRequests: AdminUserVerificationRequest[]
  givenServices: AdminUserGivenService[]
}
