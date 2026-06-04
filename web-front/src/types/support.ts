export type FaqAudience = 'ALL' | 'CLIENT' | 'PROVIDER'

export type FaqTranslation = {
  id: string
  faqItemId: string
  locale: 'EN' | 'AR'
  question: string
  answer: string
}

export type FaqAdminItem = {
  id: string
  audience: FaqAudience
  sortOrder: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
  translations: FaqTranslation[]
}

export type SupportMessageStatus = 'NEW' | 'READ' | 'ARCHIVED'

export type SupportMessageUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string | null
  role: string
  status: string
}

export type SupportMessageItem = {
  id: string
  userId: string
  name: string
  email: string
  subject: string
  message: string
  status: SupportMessageStatus
  userRole: string
  readAt: string | null
  createdAt: string
  updatedAt: string
  user: SupportMessageUser
}
