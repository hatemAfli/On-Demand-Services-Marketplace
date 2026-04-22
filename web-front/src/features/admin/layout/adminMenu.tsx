import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CommentOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  StarOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Badge } from 'antd'
import type { MenuProps } from 'antd'

export type MenuCountProps = {
  pendingVerificationTotal: number
  pendingProviderVerifications: number
  pendingCompanyVerifications: number
  openReclamations: number
}

export function buildAdminMenuItems(c: MenuCountProps): MenuProps['items'] {
  const badge = (n: number) =>
    n > 0 ? <Badge count={n} size="small" offset={[8, 0]} /> : null

  return [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'sub-users',
      icon: <TeamOutlined />,
      label: 'User Management',
      children: [
        { key: '/admin/users/all', label: 'All Users' },
        { key: '/admin/companies', label: 'Companies' },
      ],
    },
    {
      key: 'sub-validation',
      icon: <SafetyCertificateOutlined />,
      label: (
        <span>
          Validation Center {badge(c.pendingVerificationTotal)}
        </span>
      ),
      children: [
        {
          key: '/admin/validations/pending-providers',
          label: (
            <span>
              Pending Providers {badge(c.pendingProviderVerifications)}
            </span>
          ),
        },
        {
          key: '/admin/validations/pending-companies',
          label: (
            <span>
              Pending Companies {badge(c.pendingCompanyVerifications)}
            </span>
          ),
        },
        { key: '/admin/validations/history', label: 'Validation History' },
      ],
    },
    {
      key: 'sub-catalog',
      icon: <AppstoreOutlined />,
      label: 'Categories & Services',
      children: [
        { key: '/admin/catalog/categories', label: 'Categories' },
        { key: '/admin/catalog/services', label: 'Services' },
      ],
    },
    {
      key: 'sub-orders',
      icon: <CalendarOutlined />,
      label: 'Orders & Appointments',
      children: [
        { key: '/admin/orders/list', label: 'All orders' },
        { key: '/admin/appointments/list', label: 'Appointments' },
      ],
    },
    {
      key: '/admin/reclamations',
      icon: <AlertOutlined />,
      label: (
        <span>
          Reclamations {badge(c.openReclamations)}
        </span>
      ),
    },
    {
      key: '/admin/reviews',
      icon: <StarOutlined />,
      label: 'Reviews & Ratings',
    },
    {
      key: 'sub-finance',
      icon: <DollarOutlined />,
      label: 'Financial Management',
      children: [
        { key: '/admin/finance/overview', label: 'Overview' },
        { key: '/admin/finance/payouts', label: 'Payouts' },
      ],
    },
    {
      key: '/admin/messages',
      icon: <CommentOutlined />,
      label: 'Messages & Support',
    },
    {
      key: 'sub-analytics',
      icon: <BarChartOutlined />,
      label: 'Analytics & Reports',
      children: [
        { key: '/admin/analytics/overview', label: 'Overview' },
        { key: '/admin/analytics/exports', label: 'Exports' },
      ],
    },
    {
      key: 'sub-content',
      icon: <FileTextOutlined />,
      label: 'Content Management',
      children: [
        { key: '/admin/content/legal-documents', label: 'Terms & Privacy' },
        { key: '/admin/content/pages', label: 'Pages' },
        { key: '/admin/content/media', label: 'Media' },
      ],
    },
    {
      key: 'sub-settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        { key: '/admin/settings/general', label: 'General' },
        { key: '/admin/settings/security', label: 'Security' },
      ],
    },
    {
      key: '/admin/activity-logs',
      icon: <HistoryOutlined />,
      label: 'Activity Logs',
    },
  ]
}
