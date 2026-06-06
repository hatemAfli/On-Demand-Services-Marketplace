import type { AppNotification } from '../../../types/notification'

export type CompanyNotificationTarget = {
  path: string
  /** Clear query params after navigation (deep-link handoff). */
  clearSearch?: boolean
}

function str(data: Record<string, unknown> | null, key: string): string | null {
  const v = data?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Maps persisted notification `data.screen` + ids to company admin routes.
 */
export function resolveCompanyNotificationTarget(
  notification: AppNotification,
): CompanyNotificationTarget | null {
  const data = notification.data
  const screen = str(data, 'screen')
  const appointmentId = str(data, 'appointmentId')
  const complaintId = str(data, 'complaintId')
  const invitationId = str(data, 'invitationId')
  const providerId = str(data, 'providerId')

  switch (notification.type) {
    case 'COMPANY_NEW_REQUEST':
    case 'COMPANY_BOOKING_CANCELLED':
      if (appointmentId) {
        return { path: `/company/orders?order=${appointmentId}`, clearSearch: true }
      }
      return { path: '/company/orders' }

    case 'SYSTEM_ANNOUNCEMENT':
      if (screen === 'CompanyComplaintDetail' && complaintId) {
        return { path: `/company/complaints/${complaintId}` }
      }
      if (complaintId) {
        return { path: `/company/complaints/${complaintId}` }
      }
      return { path: '/company/dashboard' }

    case 'EMPLOYEE_INVITATION_ACCEPTED':
      if (providerId) {
        return {
          path: `/company/providers?provider=${providerId}`,
          clearSearch: true,
        }
      }
      return { path: '/company/providers' }

    case 'EMPLOYEE_INVITATION_DECLINED':
      if (invitationId) {
        return {
          path: `/company/providers?tab=invitations&invitation=${invitationId}`,
          clearSearch: true,
        }
      }
      return { path: '/company/providers?tab=invitations', clearSearch: true }

    case 'COMPLAINT_FILED':
    case 'COMPLAINT_STATUS_UPDATED':
    case 'COMPLAINT_RESOLVED':
    case 'COMPLAINT_DISMISSED':
      if (complaintId) {
        return { path: `/company/complaints/${complaintId}` }
      }
      return { path: '/company/complaints' }

    case 'NEW_REVIEW':
      return { path: '/company/ratings' }

    case 'ACCOUNT_VERIFIED':
    case 'ACCOUNT_REJECTED':
      return { path: '/company/settings' }

    default:
      break
  }

  if (screen === 'CompanyOrders' || screen === 'CompanyOrdersPage') {
    if (appointmentId) {
      return { path: `/company/orders?order=${appointmentId}`, clearSearch: true }
    }
    return { path: '/company/orders' }
  }

  if (
    screen === 'CompanyComplaintDetail' ||
    screen === 'CompanyComplaintsPage'
  ) {
    if (complaintId) {
      return { path: `/company/complaints/${complaintId}` }
    }
    return { path: '/company/complaints' }
  }

  if (screen === 'CompanyProvidersPage') {
    if (providerId) {
      return {
        path: `/company/providers?provider=${providerId}`,
        clearSearch: true,
      }
    }
    return { path: '/company/providers' }
  }

  if (screen === 'CompanyInvitationsPage') {
    if (invitationId) {
      return {
        path: `/company/providers?tab=invitations&invitation=${invitationId}`,
        clearSearch: true,
      }
    }
    return { path: '/company/providers?tab=invitations', clearSearch: true }
  }

  if (appointmentId) {
    return { path: `/company/orders?order=${appointmentId}`, clearSearch: true }
  }

  return null
}
