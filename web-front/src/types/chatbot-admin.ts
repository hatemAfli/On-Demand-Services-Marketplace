export type AdminChatbotStats = {
  totalSessions: number
  totalMessages: number
  sessionsLast24h: number
  messagesLast24h: number
  fallbackRatePercent: number
  avgMessagesPerSession: number
  errorCount: number
}

export type AdminChatbotSessionListItem = {
  sessionId: string
  title: string
  locale: string
  createdAt: string
  updatedAt: string
  messageCount: number
  fallbackCount: number
  deletedAt: string | null
  client: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    city: string | null
  }
}

export type AdminChatbotSessionsResponse = {
  items: AdminChatbotSessionListItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type AdminChatbotMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  providers: unknown[]
  suggestions: string[]
  fallback: boolean
  intentDetected: boolean | null
  latencyMs: number | null
  errorCode: string | null
}

export type AdminChatbotSessionDetail = {
  session: {
    sessionId: string
    title: string
    locale: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  }
  client: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    phoneNumber: string | null
    city: string | null
  }
  messages: AdminChatbotMessage[]
}

export type GetAdminChatbotSessionsParams = {
  take?: number
  skip?: number
  search?: string
  clientId?: string
  locale?: string
  from?: string
  to?: string
  hasFallback?: boolean
  includeDeleted?: boolean
}
