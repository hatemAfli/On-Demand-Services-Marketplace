import apiClient from './api'
import type {
  CompanyEmployeesResponse,
  EmployeeDetail,
  InvitationRow,
  ProviderLookupResult,
} from '../types/company'

export type GetEmployeesParams = {
  search?: string
  status?: string
  take?: number
  skip?: number
}

export const companyApi = {
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
}

export default companyApi
