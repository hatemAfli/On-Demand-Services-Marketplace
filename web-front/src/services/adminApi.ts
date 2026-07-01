import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { env } from '../config/env'
import { supabase } from '../lib/supabase'
import type {
  AdminChatbotSessionDetail,
  AdminChatbotSessionsResponse,
  AdminChatbotStats,
  GetAdminChatbotSessionsParams,
} from '../types/chatbot-admin'
import type {
  AdminAppointment,
  AdminComplaint,
  AdminReview,
  AppointmentStats,
  AppointmentStatus,
  ComplaintCategory,
  ComplaintDecision,
  ComplaintStats,
  ComplaintStatus,
  PaginatedResponse,
  ReviewStats,
  ReviewVisibility,
  PlatformAuditAction,
  PlatformActivityLogEntry,
  PlatformActivityLogStats,
} from '../types/admin'

const adminApiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

adminApiClient.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export type GetAdminAppointmentsParams = {
  status?: AppointmentStatus
  providerId?: string
  clientId?: string
  from?: string
  to?: string
  hasComplaints?: boolean
  hasDispute?: boolean
  sort?: 'recent' | 'oldest' | 'scheduled_asc' | 'scheduled_desc'
  take?: number
  skip?: number
}

export type GetAdminComplaintsParams = {
  status?: ComplaintStatus
  category?: ComplaintCategory
  providerId?: string
  clientId?: string
  sort?: 'recent' | 'oldest'
  take?: number
  skip?: number
}

export type GetAdminReviewsParams = {
  visibility?: ReviewVisibility
  minRating?: number
  maxRating?: number
  providerId?: string
  sort?: 'recent' | 'oldest' | 'highest' | 'lowest'
  take?: number
  skip?: number
}

export type InterveneAppointmentPayload = {
  action: 'FORCE_COMPLETE' | 'FORCE_CANCEL'
  reason: string
}

export type ReviewComplaintPayload = {
  status: ComplaintStatus
  adminNotes?: string
  adminResponse?: string
  decision?: ComplaintDecision
}

export type GetPlatformActivityLogsParams = {
  take?: number
  skip?: number
  action?: PlatformAuditAction
  search?: string
  from?: string
  to?: string
}

export const adminApi = {
  getAdminAppointments: (
    params?: GetAdminAppointmentsParams,
  ): Promise<AxiosResponse<PaginatedResponse<AdminAppointment>>> =>
    adminApiClient.get('/admin/appointments', { params }),

  getAdminAppointmentById: (
    id: string,
  ): Promise<AxiosResponse<AdminAppointment>> =>
    adminApiClient.get(`/admin/appointments/${id}`),

  getAppointmentStats: (): Promise<AxiosResponse<AppointmentStats>> =>
    adminApiClient.get('/admin/appointments/stats'),

  flagAppointmentAsDisputed: (id: string): Promise<AxiosResponse<void>> =>
    adminApiClient.patch(`/admin/appointments/${id}/flag-disputed`),

  interveneAppointment: (
    id: string,
    payload: InterveneAppointmentPayload,
  ): Promise<AxiosResponse<void>> =>
    adminApiClient.patch(`/admin/appointments/${id}/intervene`, payload),

  getAdminComplaints: (
    params?: GetAdminComplaintsParams,
  ): Promise<AxiosResponse<PaginatedResponse<AdminComplaint>>> =>
    adminApiClient.get('/complaints', { params }),

  getAdminComplaintById: (
    id: string,
  ): Promise<AxiosResponse<AdminComplaint>> =>
    adminApiClient.get(`/complaints/${id}`),

  reviewComplaint: (
    id: string,
    payload: ReviewComplaintPayload,
  ): Promise<AxiosResponse<AdminComplaint>> =>
    adminApiClient.patch(`/complaints/${id}/review`, payload),

  getComplaintStats: (): Promise<AxiosResponse<ComplaintStats>> =>
    adminApiClient.get('/complaints/stats'),

  getAdminReviews: (
    params?: GetAdminReviewsParams,
  ): Promise<AxiosResponse<PaginatedResponse<AdminReview>>> =>
    adminApiClient.get('/admin/reviews', { params }),

  getAdminReviewById: (id: string): Promise<AxiosResponse<AdminReview>> =>
    adminApiClient.get(`/admin/reviews/${id}`),

  hideReview: (
    id: string,
    payload: { reason: string },
  ): Promise<AxiosResponse<AdminReview>> =>
    adminApiClient.patch(`/admin/reviews/${id}/hide`, payload),

  restoreReview: (id: string): Promise<AxiosResponse<AdminReview>> =>
    adminApiClient.patch(`/admin/reviews/${id}/restore`),

  deleteReview: (id: string): Promise<AxiosResponse<void>> =>
    adminApiClient.delete(`/admin/reviews/${id}`),

  getReviewStats: (): Promise<AxiosResponse<ReviewStats>> =>
    adminApiClient.get('/admin/reviews/stats'),

  getActivityLogStats: (): Promise<AxiosResponse<PlatformActivityLogStats>> =>
    adminApiClient.get('/admin/activity-logs/stats'),

  getActivityLogs: (
    params?: GetPlatformActivityLogsParams,
  ): Promise<AxiosResponse<PaginatedResponse<PlatformActivityLogEntry>>> =>
    adminApiClient.get('/admin/activity-logs', { params }),

  exportActivityLogsCsv: (): Promise<AxiosResponse<Blob>> =>
    adminApiClient.get('/admin/activity-logs/export', { responseType: 'blob' }),

  getChatbotStats: (): Promise<AxiosResponse<AdminChatbotStats>> =>
    adminApiClient.get('/admin/chatbot/stats'),

  getAdminChatbotSessions: (
    params?: GetAdminChatbotSessionsParams,
  ): Promise<AxiosResponse<AdminChatbotSessionsResponse>> =>
    adminApiClient.get('/admin/chatbot/sessions', { params }),

  getAdminChatbotSession: (
    sessionId: string,
  ): Promise<AxiosResponse<AdminChatbotSessionDetail>> =>
    adminApiClient.get(`/admin/chatbot/sessions/${sessionId}`),
}
