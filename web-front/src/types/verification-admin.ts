/** Normalized admin verification list/detail item (GET /admin/verification-requests) */

export type VerificationReviewStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type VerificationOwnerType = 'PROVIDER' | 'COMPANY'

export type AdminVerificationCompanySummary = {
  id: string
  companyName: string
  taxId: string
  logo: string | null
  city: string
  address: string | null
  email: string | null
}

export type AdminVerificationUser = {
  id: string
  email: string
  phoneNumber: string | null
  firstName: string
  lastName: string
  role: string
  status: string
  companyAdmin?: {
    id: string
    companyId: string
    company: AdminVerificationCompanySummary | null
  } | null
  provider?: {
    type: string
    city: string
    address: string | null
    photoUrl: string | null
    companyId: string | null
  } | null
}

export type AdminVerificationServiceSummary = {
  id: string
  name: string
  category: { slug: string; name: string }
}

export type AdminVerificationDocument = {
  id: string
  type: string
  fichierUrl: string
  uploadedAt: string
  validatedAt: string | null
  isAccepted: boolean | null
  rejectionReason: string | null
}

export type AdminVerificationRequestItem = {
  id: string
  userId: string
  ownerType: VerificationOwnerType
  serviceId: string | null
  requestStatus: VerificationReviewStatus
  /** Rejection reason only (populated when status is REJECTED). */
  adminComment: string | null
  ownerComment: string | null
  createdAt: string
  updatedAt: string
  user: AdminVerificationUser
  service: AdminVerificationServiceSummary | null
  documents: AdminVerificationDocument[]
}

export type AdminVerificationListResponse = {
  items: AdminVerificationRequestItem[]
  total: number
  skip: number
  take: number
}
