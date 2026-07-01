import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosInstance,
} from 'axios'
import { env } from '../config/env'
import { supabase } from '../lib/supabase'
import type {
  CreateServiceCategoryInput,
  ServiceCategory,
  UpdateServiceCategoryInput,
} from '../types/service-category'
import type {
  AdminService,
  CreateAdminServiceInput,
  UpdateAdminServiceInput,
} from '../types/service'
import type {
  AddLegalDocumentVersionInput,
  CreateLegalDocumentInput,
  LegalDocumentAdminItem,
  PatchLegalDocumentVersionInput,
  UpdateLegalDocumentInput,
} from '../types/legal-document'
import type { AdminCompaniesListResponse } from '../types/admin-company'
import type { AdminUsersListResponse } from '../types/admin-user'
import type { AdminUserDetail } from '../types/admin-user-detail'
import type { AccountStatus } from '../types/user'
import type { UserRole } from '../types/user'
import type { AdminVerificationListResponse, AdminVerificationRequestItem } from '../types/verification-admin'

const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(
  async (config) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (err) => Promise.reject(err),
)

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean }
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true
    try {
      const { data, error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr || !data.session) {
        throw refreshErr ?? new Error('No session after refresh')
      }
      original.headers = original.headers ?? new AxiosHeaders()
      original.headers.Authorization = `Bearer ${data.session.access_token}`
      return apiClient(original)
    } catch {
      await supabase.auth.signOut()
      return Promise.reject(error)
    }
  },
)

export const api = {
  getCurrentUser: () => apiClient.get<unknown>('/auth/me'),

  listAdminUsers: (params?: {
    role?: UserRole
    search?: string
    skip?: number
    take?: number
  }) => apiClient.get<AdminUsersListResponse>('/admin/users', { params }),

  getAdminUserById: (id: string) =>
    apiClient.get<AdminUserDetail>(`/admin/users/${id}`),

  updateAdminUserStatus: (
    id: string,
    body: { status: AccountStatus; reason?: string },
  ) => apiClient.patch<{ id: string; status: AccountStatus; message: string }>(
    `/admin/users/${id}/status`,
    body,
  ),

  listAdminCompanies: (params?: { skip?: number; take?: number }) =>
    apiClient.get<AdminCompaniesListResponse>('/admin/companies', { params }),

  listAdminVerificationRequests: (params?: {
    status?: string
    ownerType?: 'PROVIDER' | 'COMPANY'
    userId?: string
    skip?: number
    take?: number
  }) => apiClient.get<AdminVerificationListResponse>('/admin/verification-requests', { params }),

  getAdminVerificationRequest: (id: string) =>
    apiClient.get<AdminVerificationRequestItem>(`/admin/verification-requests/${id}`),

  markVerificationUnderReview: (id: string) =>
    apiClient.patch<AdminVerificationRequestItem>(`/admin/verification-requests/${id}/review`),

  approveVerificationRequest: (id: string) =>
    apiClient.post<AdminVerificationRequestItem>(
      `/admin/verification-requests/${id}/approve`,
    ),

  rejectVerificationRequest: (id: string, body: { reason: string }) =>
    apiClient.post<AdminVerificationRequestItem>(
      `/admin/verification-requests/${id}/reject`,
      body,
    ),

  reviewVerificationDocument: (
    requestId: string,
    documentId: string,
    body: { decision: 'accept' | 'reject'; rejectionReason?: string },
  ) =>
    apiClient.patch<AdminVerificationRequestItem>(
      `/admin/verification-requests/${requestId}/documents/${documentId}`,
      body,
    ),

  listAdminServiceCategories: (params?: { activeOnly?: boolean }) =>
    apiClient.get<ServiceCategory[]>('/admin/service-categories', { params }),

  createAdminServiceCategory: (body: CreateServiceCategoryInput) =>
    apiClient.post<ServiceCategory>('/admin/service-categories', body),

  updateAdminServiceCategory: (id: string, body: UpdateServiceCategoryInput) =>
    apiClient.patch<ServiceCategory>(`/admin/service-categories/${id}`, body),

  deleteAdminServiceCategory: (id: string) =>
    apiClient.delete(`/admin/service-categories/${id}`),

  listAdminServices: (params?: { activeOnly?: boolean; categoryId?: string }) =>
    apiClient.get<AdminService[]>('/admin/services', { params }),

  createAdminService: (body: CreateAdminServiceInput) =>
    apiClient.post<AdminService>('/admin/services', body),

  updateAdminService: (id: string, body: UpdateAdminServiceInput) =>
    apiClient.patch<AdminService>(`/admin/services/${id}`, body),

  deleteAdminService: (id: string) => apiClient.delete(`/admin/services/${id}`),

  listAdminLegalDocuments: () =>
    apiClient.get<LegalDocumentAdminItem[]>('/admin/legal-documents'),

  createAdminLegalDocument: (body: CreateLegalDocumentInput) =>
    apiClient.post<LegalDocumentAdminItem>('/admin/legal-documents', body),

  updateAdminLegalDocument: (id: string, body: UpdateLegalDocumentInput) =>
    apiClient.patch<LegalDocumentAdminItem>(`/admin/legal-documents/${id}`, body),

  addAdminLegalDocumentVersion: (id: string, body: AddLegalDocumentVersionInput) =>
    apiClient.post<LegalDocumentAdminItem>(`/admin/legal-documents/${id}/versions`, body),

  patchAdminLegalDocumentVersion: (
    documentId: string,
    versionId: string,
    body: PatchLegalDocumentVersionInput,
  ) =>
    apiClient.patch<LegalDocumentAdminItem>(
      `/admin/legal-documents/${documentId}/versions/${versionId}`,
      body,
    ),

  deleteAdminLegalDocument: (id: string) =>
    apiClient.delete(`/admin/legal-documents/${id}`),

  listAdminFaq: () => apiClient.get<import('../types/support').FaqAdminItem[]>('/admin/faq'),

  createAdminFaq: (body: {
    audience: import('../types/support').FaqAudience
    sortOrder?: number
    isPublished?: boolean
    en: { question: string; answer: string }
    ar: { question: string; answer: string }
  }) => apiClient.post('/admin/faq', body),

  updateAdminFaq: (
    id: string,
    body: Partial<{
      audience: import('../types/support').FaqAudience
      sortOrder: number
      isPublished: boolean
      en: { question: string; answer: string }
      ar: { question: string; answer: string }
    }>,
  ) => apiClient.patch(`/admin/faq/${id}`, body),

  deleteAdminFaq: (id: string) => apiClient.delete(`/admin/faq/${id}`),

  listAdminSupportMessages: (params?: {
    status?: import('../types/support').SupportMessageStatus
    search?: string
  }) =>
    apiClient.get<import('../types/support').SupportMessageItem[]>(
      '/admin/support-messages',
      { params },
    ),

  getAdminSupportMessage: (id: string) =>
    apiClient.get<import('../types/support').SupportMessageItem>(
      `/admin/support-messages/${id}`,
    ),

  updateAdminSupportMessageStatus: (
    id: string,
    body: { status: import('../types/support').SupportMessageStatus },
  ) => apiClient.patch(`/admin/support-messages/${id}/status`, body),

  getAdminSupportMessageStats: () =>
    apiClient.get<{ newCount: number }>('/admin/support-messages/stats'),
}

export default apiClient
