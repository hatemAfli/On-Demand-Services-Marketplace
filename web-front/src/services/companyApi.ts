import apiClient from './api'
import type {
  CategoryFilter,
  CompanyAppointment,
  CompanyAppointmentStats,
  CompanyAppointmentsResponse,
  CompanyAvailableProvider,
  CompanyRescheduleOptionsResponse,
  CompanyEmployeesResponse,
  CompanyRespondPayload,
  CompanyServiceDetail,
  CompanyServiceGroup,
  EmployeeDetail,
  GivenServiceFull,
  InvitationRow,
  ListCompanyAppointmentsParams,
  ProviderLookupResult,
  CompanyDaySchedule,
  ProviderAvailabilityDay,
  ProviderDayOff,
  UpsertAvailabilityPayload,
  CompanyReviewStats,
  CompanyReviewBreakdownRow,
  CompanyReviewByService,
  CompanyReviewTrendPoint,
  CompanyTopRatedProvider,
  CompanyReview,
  CompanyReviewsResponse,
  ListCompanyReviewsParams,
  CompanySettingsResponse,
  CompanySettingsProfile,
  CompanyAuditLogsResponse,
  CompanyComplaintStats,
  CompanyComplaintsResponse,
  CompanyComplaintListItem,
  ListCompanyComplaintsParams,
  ReviewCompanyComplaintPayload,
  CompanyDashboardData,
} from '../types/company'

export type GetEmployeesParams = {
  search?: string
  status?: string
  take?: number
  skip?: number
}

export const companyApi = {
  getCompanyDashboard: () =>
    apiClient
      .get<CompanyDashboardData>('/company/dashboard')
      .then((r) => r.data),

  getEmployees: (params?: GetEmployeesParams) =>
    apiClient.get<CompanyEmployeesResponse>('/company/employees', { params }),

  getEmployeeById: (providerId: string) =>
    apiClient.get<EmployeeDetail>(`/company/employees/${providerId}`),

  lookupProviderByEmail: (email: string) =>
    apiClient.get<ProviderLookupResult>('/company/employees/lookup', {
      params: { email },
    }),

  sendInvitation: (payload: { email: string; message?: string }) =>
    apiClient.post<unknown>('/company/employees/invite', payload),

  cancelInvitation: (invitationId: string) =>
    apiClient.delete<void>(`/company/employees/invitations/${invitationId}`),

  removeEmployee: (providerId: string) =>
    apiClient.delete<void>(`/company/employees/${providerId}`),

  getMyInvitations: (status?: string) =>
    apiClient.get<InvitationRow[]>('/company/employees/invitations', {
      params: status ? { status } : undefined,
    }),

  // ─── Company services ────────────────────────────────────────────────────────

  getCompanyServices: (params?: { search?: string; categoryId?: string; active?: boolean }) =>
    apiClient
      .get<CompanyServiceGroup[]>('/company/services', { params })
      .then((r) => r.data),

  getCompanyCategories: () =>
    apiClient
      .get<CategoryFilter[]>('/company/services/categories')
      .then((r) => r.data),

  getCompanyServiceDetail: (serviceId: string) =>
    apiClient
      .get<CompanyServiceDetail>(`/company/services/${serviceId}`)
      .then((r) => r.data),

  getGivenServiceForEdit: (givenServiceId: string) =>
    apiClient
      .get<GivenServiceFull>(`/company/services/given/${givenServiceId}`)
      .then((r) => r.data),

  updateGivenService: (
    givenServiceId: string,
    data: Partial<{
      pricingType: string
      price: number
      minimumHours: number
      estimatedDurationMinutes: number
      description: string
      whatIsIncluded: string
      whatIsNotIncluded: string
      toolsProvidedByProvider: boolean
      serviceAreaNotes: string
      advanceBookingRequiredHours: number
      serviceRadiusKm: number
      isAvailableImmediately: boolean
      clientMustProvide: string
      active: boolean
    }>,
  ) =>
    apiClient
      .patch<GivenServiceFull>(`/company/services/given/${givenServiceId}`, data)
      .then((r) => r.data),

  toggleGivenServiceActive: (givenServiceId: string, active: boolean) =>
    apiClient
      .patch<{ id: string; active: boolean }>(
        `/company/services/given/${givenServiceId}/toggle`,
        { active },
      )
      .then((r) => r.data),

  addGalleryImage: (givenServiceId: string, imageUrl: string) =>
    apiClient
      .post<{ id: string; imageUrl: string }>(
        `/company/services/given/${givenServiceId}/gallery`,
        { imageUrl },
      )
      .then((r) => r.data),

  /** Upload a local image to the provider gallery bucket and attach to the service. */
  uploadGalleryImage: (givenServiceId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<{ id: string; imageUrl: string }>(
        `/company/services/given/${givenServiceId}/gallery/upload`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data)
  },

  removeGalleryImage: (galleryId: string) =>
    apiClient
      .delete<void>(`/company/services/gallery/${galleryId}`)
      .then((r) => r.data),

  // ─── Company orders / appointments ────────────────────────────────────────────

  getCompanyAppointments: (params?: ListCompanyAppointmentsParams) =>
    apiClient
      .get<CompanyAppointmentsResponse>('/company/appointments', { params })
      .then((r) => r.data),

  getCompanyAppointmentStats: () =>
    apiClient
      .get<CompanyAppointmentStats>('/company/appointments/stats')
      .then((r) => r.data),

  getCompanyAppointmentById: (id: string) =>
    apiClient
      .get<CompanyAppointment>(`/company/appointments/${id}`)
      .then((r) => r.data),

  getCompanyAppointmentAvailableProviders: (id: string) =>
    apiClient
      .get<CompanyAvailableProvider[]>(
        `/company/appointments/${id}/available-providers`,
      )
      .then((r) => r.data),

  getCompanyAppointmentRescheduleOptions: (
    id: string,
    params: { date: string } | { days?: number },
  ) =>
    apiClient
      .get<CompanyRescheduleOptionsResponse>(
        `/company/appointments/${id}/reschedule-options`,
        { params, timeout: 30000 },
      )
      .then((r) => r.data),

  respondCompanyAppointment: (id: string, payload: CompanyRespondPayload) =>
    apiClient
      .patch<CompanyAppointment>(`/company/appointments/${id}/respond`, payload)
      .then((r) => r.data),

  assignCompanyAppointmentProvider: (
    id: string,
    payload: { providerId: string; confirm?: boolean },
  ) =>
    apiClient
      .patch<CompanyAppointment>(`/company/appointments/${id}/assign`, payload)
      .then((r) => r.data),

  // ─── Company schedule / capacity ──────────────────────────────────────────────

  getCompanyDaySchedule: (params: { date: string; search?: string }) =>
    apiClient
      .get<CompanyDaySchedule>('/company/schedule', { params })
      .then((r) => r.data),

  getEmployeeAvailability: (providerId: string) =>
    apiClient
      .get<ProviderAvailabilityDay[]>(
        `/company/schedule/employees/${providerId}/availability`,
      )
      .then((r) => r.data),

  upsertEmployeeAvailability: (
    providerId: string,
    payload: UpsertAvailabilityPayload,
  ) =>
    apiClient
      .patch<ProviderAvailabilityDay[]>(
        `/company/schedule/employees/${providerId}/availability`,
        payload,
      )
      .then((r) => r.data),

  getEmployeeDaysOff: (providerId: string, from?: string, to?: string) =>
    apiClient
      .get<ProviderDayOff[]>(
        `/company/schedule/employees/${providerId}/days-off`,
        { params: { from, to } },
      )
      .then((r) => r.data),

  createEmployeeDayOff: (
    providerId: string,
    payload: { date: string; reason?: string },
  ) =>
    apiClient
      .post<ProviderDayOff>(
        `/company/schedule/employees/${providerId}/days-off`,
        payload,
      )
      .then((r) => r.data),

  deleteEmployeeDayOff: (providerId: string, dayOffId: string) =>
    apiClient
      .delete<{ deleted: boolean }>(
        `/company/schedule/employees/${providerId}/days-off/${dayOffId}`,
      )
      .then((r) => r.data),

  // ─── Company reviews ──────────────────────────────────────────────────────────

  getCompanyReviewStats: () =>
    apiClient
      .get<CompanyReviewStats>('/company/reviews/stats')
      .then((r) => r.data),

  getCompanyReviewBreakdown: () =>
    apiClient
      .get<CompanyReviewBreakdownRow[]>('/company/reviews/breakdown')
      .then((r) => r.data),

  getCompanyReviewsByService: () =>
    apiClient
      .get<CompanyReviewByService[]>('/company/reviews/by-service')
      .then((r) => r.data),

  getCompanyReviewTrends: () =>
    apiClient
      .get<CompanyReviewTrendPoint[]>('/company/reviews/trends')
      .then((r) => r.data),

  getCompanyTopRatedProviders: () =>
    apiClient
      .get<CompanyTopRatedProvider[]>('/company/reviews/top-providers')
      .then((r) => r.data),

  getCompanyReviews: (params?: ListCompanyReviewsParams) =>
    apiClient
      .get<CompanyReviewsResponse>('/company/reviews', { params })
      .then((r) => r.data),

  getCompanyReviewById: (id: string) =>
    apiClient
      .get<CompanyReview>(`/company/reviews/${id}`)
      .then((r) => r.data),

  // ─── Company settings ─────────────────────────────────────────────────────────

  getCompanySettings: () =>
    apiClient
      .get<CompanySettingsResponse>('/company/settings')
      .then((r) => r.data),

  updateCompanyProfile: (payload: Partial<CompanySettingsProfile>) =>
    apiClient
      .patch<CompanySettingsProfile>('/company/settings/profile', payload)
      .then((r) => r.data),

  updateCompanyBranding: (payload: { logo?: string | null }) =>
    apiClient
      .patch<{ logo: string | null }>('/company/settings/branding', payload)
      .then((r) => r.data),

  /** Upload a logo file to Supabase (`avatars/logos/{companyId}/…`) and save the public URL. */
  uploadCompanyLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<{ logo: string | null }>(
        '/company/settings/branding/logo/upload',
        form,
        {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  getCompanyAuditLogs: (params?: { take?: number; skip?: number }) =>
    apiClient
      .get<CompanyAuditLogsResponse>('/company/settings/audit-logs', { params })
      .then((r) => r.data),

  downloadCompanyExport: (type: 'providers' | 'orders' | 'summary' | 'audit-logs') =>
    apiClient.get(`/company/settings/export/${type}`, { responseType: 'blob' }),

  // ─── Company complaints ─────────────────────────────────────────────────────

  getCompanyComplaintStats: () =>
    apiClient
      .get<CompanyComplaintStats>('/company/complaints/stats')
      .then((r) => r.data),

  getCompanyComplaints: (params?: ListCompanyComplaintsParams) =>
    apiClient
      .get<CompanyComplaintsResponse>('/company/complaints', { params })
      .then((r) => r.data),

  getCompanyComplaintById: (id: string) =>
    apiClient
      .get<CompanyComplaintListItem>(`/company/complaints/${id}`)
      .then((r) => r.data),

  reviewCompanyComplaint: (id: string, payload: ReviewCompanyComplaintPayload) =>
    apiClient
      .patch<CompanyComplaintListItem>(`/company/complaints/${id}/review`, payload)
      .then((r) => r.data),
}

export default companyApi
