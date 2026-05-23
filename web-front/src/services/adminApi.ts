import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
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
} from '../types/admin'

const baseURL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/$/,
  '',
)

/** Optional explicit JWT override; Supabase session in localStorage is used when unset. */
export const ADMIN_JWT_STORAGE_KEY = 'admin_access_token'

function readAdminJwtFromLocalStorage(): string | null {
  const explicit = localStorage.getItem(ADMIN_JWT_STORAGE_KEY)
  if (explicit) return explicit

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key?.endsWith('-auth-token')) continue
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as {
        access_token?: string
        currentSession?: { access_token?: string }
      }
      return parsed.access_token ?? parsed.currentSession?.access_token ?? null
    } catch {
      continue
    }
  }

  return null
}

const adminApiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

adminApiClient.interceptors.request.use((config) => {
  const token = readAdminJwtFromLocalStorage()
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
}

export default adminApiClient
