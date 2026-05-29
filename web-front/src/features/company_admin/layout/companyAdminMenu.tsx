import type { IconType } from 'react-icons'
import {
  FaCalendarCheck,
  FaClipboardList,
  FaDollarSign,
  FaGem,
  FaGear,
  FaStar,
  FaTableCellsLarge,
  FaUsers,
  FaWallet,
} from 'react-icons/fa6'

export type CompanyMenuItem = {
  key: string
  label: string
  icon: IconType
  badge?: string
}

export type CompanyMenuSection = {
  title: string
  items: CompanyMenuItem[]
}

export const companyAdminMenuSections: CompanyMenuSection[] = [
  {
    title: 'Main Menu',
    items: [
      { key: '/company/dashboard', label: 'Dashboard', icon: FaTableCellsLarge },
      { key: '/company/providers', label: 'Providers', icon: FaUsers },
      { key: '/company/services', label: 'Services', icon: FaWallet },
      { key: '/company/orders', label: 'Orders', icon: FaClipboardList, badge: '12' },
      {
        key: '/company/schedule-capacity',
        label: 'Schedule & Capacity',
        icon: FaCalendarCheck,
      },
      { key: '/company/finance', label: 'Finance', icon: FaDollarSign },
      { key: '/company/ratings', label: 'Ratings', icon: FaStar },
    ],
  },
  {
    title: 'Account',
    items: [
      { key: '/company/subscription-plan', label: 'Subscription & Plan', icon: FaGem },
      { key: '/company/settings', label: 'Settings', icon: FaGear },
    ],
  },
]
