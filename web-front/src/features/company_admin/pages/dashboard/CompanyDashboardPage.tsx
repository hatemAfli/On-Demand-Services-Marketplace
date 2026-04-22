import { Card, Typography } from 'antd'
import { useAuthStore } from '../../../../stores/authStore'

export function CompanyDashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <Card>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Welcome, {user?.firstName ?? 'Company admin'}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        This is your dedicated company admin workspace. Manage your company
        services, team permissions, and activity from the left menu.
      </Typography.Paragraph>
    </Card>
  )
}
