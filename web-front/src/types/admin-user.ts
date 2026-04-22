import type { AccountStatus, UserRole } from './user'

export type AdminUserListItem = {
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
}

export type AdminUsersListResponse = {
  items: AdminUserListItem[]
  total: number
  skip?: number
  take?: number
}
