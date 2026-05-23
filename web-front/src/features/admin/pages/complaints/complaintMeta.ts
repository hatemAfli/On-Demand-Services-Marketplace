import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Building2,
  CircleDollarSign,
  Clock,
  Construction,
  Ellipsis,
  Home,
  MinusCircle,
  RefreshCcw,
  Shield,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import type {
  AdminComplaint,
  ComplaintCategory,
  ComplaintDecision,
} from '../../../../types/admin'

export const COMPLAINT_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
  'WITHDRAWN',
] as const

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'SERVICE_QUALITY',
  'NO_SHOW',
  'LATE_ARRIVAL',
  'UNPROFESSIONAL',
  'OVERCHARGING',
  'PROPERTY_DAMAGE',
  'SAFETY_CONCERN',
  'FRAUD',
  'OTHER',
]

export const COMPLAINT_CATEGORY_META: Record<
  ComplaintCategory,
  { label: string; Icon: LucideIcon }
> = {
  SERVICE_QUALITY: { label: 'Service quality', Icon: Construction },
  NO_SHOW: { label: 'No-show', Icon: UserX },
  LATE_ARRIVAL: { label: 'Late arrival', Icon: Clock },
  UNPROFESSIONAL: { label: 'Unprofessional', Icon: AlertTriangle },
  OVERCHARGING: { label: 'Overcharging', Icon: CircleDollarSign },
  PROPERTY_DAMAGE: { label: 'Property damage', Icon: Home },
  SAFETY_CONCERN: { label: 'Safety concern', Icon: Shield },
  FRAUD: { label: 'Fraud', Icon: AlertCircle },
  OTHER: { label: 'Other', Icon: Ellipsis },
}

export const COMPLAINT_DECISION_META: Record<
  ComplaintDecision,
  {
    label: string
    description: string
    Icon: LucideIcon
    tone: 'default' | 'danger' | 'severe'
  }
> = {
  WARNING_ISSUED: {
    label: 'Issue formal warning',
    description: 'Warn the provider about this incident',
    Icon: AlertTriangle,
    tone: 'default',
  },
  NO_ACTION: {
    label: 'No action required',
    description: 'Close without further action',
    Icon: MinusCircle,
    tone: 'default',
  },
  ACCOUNT_SUSPENDED: {
    label: 'Suspend account',
    description: 'Temporarily suspend the provider account',
    Icon: UserX,
    tone: 'danger',
  },
  ACCOUNT_BANNED: {
    label: 'Permanently ban',
    description: 'Permanently ban the provider account',
    Icon: Ban,
    tone: 'severe',
  },
  REFUND_ISSUED: {
    label: 'Issue refund/compensation',
    description: 'Compensate or refund the client',
    Icon: RefreshCcw,
    tone: 'default',
  },
  FORWARDED_TO_COMPANY: {
    label: 'Forward to company admin',
    description: 'Escalate to the employer company',
    Icon: Building2,
    tone: 'default',
  },
}

export function getDecisionLabel(decision: ComplaintDecision): string {
  return COMPLAINT_DECISION_META[decision]?.label ?? decision
}

export function formatPersonName(first: string, last: string): string {
  return `${first} ${last}`.trim() || '—'
}

export function pickServiceNameFromAppointment(
  appointment: AdminComplaint['appointment'],
): string {
  const translations = appointment.givenService?.service?.translations ?? []
  const en = translations.find((t) => t.locale === 'EN' || t.locale === 'en')
  return (en ?? translations[0])?.name?.trim() || 'Service'
}
