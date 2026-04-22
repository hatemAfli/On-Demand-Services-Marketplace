import type { AccountStatus } from './user'

export type AdminCompanyAdminUser = {
  email: string
  firstName: string
  lastName: string
  status: AccountStatus
}

export type AdminCompanyListItem = {
  id: string
  companyName: string
  taxId: string
  logo: string | null
  city: string
  address: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  serviceZones: string[]
  averageRating: number | null
  totalReviews: number
  adminId: string | null
  createdAt: string
  updatedAt: string
  providersCount: number
  adminUser: AdminCompanyAdminUser | null
}

export type AdminCompaniesListResponse = {
  items: AdminCompanyListItem[]
  total: number
  skip?: number
  take?: number
}
