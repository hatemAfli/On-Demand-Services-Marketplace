import type { CompanyComplaintCategory, ComplaintForwardTarget } from '../../../../types/company'

export const COMPLAINT_CATEGORY_LABELS: Record<CompanyComplaintCategory, string> = {
  SERVICE_QUALITY: 'Service quality',
  NO_SHOW: 'No-show',
  LATE_ARRIVAL: 'Late arrival',
  UNPROFESSIONAL: 'Unprofessional',
  OVERCHARGING: 'Overcharging',
  PROPERTY_DAMAGE: 'Property damage',
  SAFETY_CONCERN: 'Safety concern',
  FRAUD: 'Fraud',
  OTHER: 'Other',
}

export const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
  WITHDRAWN: 'Withdrawn',
}

export const FORWARD_TARGET_LABELS: Record<ComplaintForwardTarget, string> = {
  PLATFORM: 'Platform only',
  COMPANY: 'Company only',
  BOTH: 'Platform & company',
}

export function formatPersonName(first?: string | null, last?: string | null): string {
  const n = `${first ?? ''} ${last ?? ''}`.trim()
  return n || '—'
}
