import {
  AlertOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Spin, Statistic, Typography } from 'antd'
import { useOutletContext } from 'react-router-dom'
import { useAuthStore } from '../../../../stores/authStore'
import type { AdminOutletContext } from '../../layout/adminOutletContext'

export function DashboardHomePage() {
  const user = useAuthStore((s) => s.user)
  const counts = useOutletContext<AdminOutletContext>()

  const greeting =
    user?.firstName?.trim() ? `Welcome back, ${user.firstName}` : 'Welcome back'

  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {greeting}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Here is a snapshot of items that need your attention. Open the
        Validation Center from the sidebar to review pending profiles.
      </Typography.Paragraph>

      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" className="admin-stat-card">
            {counts.loading ? (
              <Spin />
            ) : (
              <Statistic
                title="Pending validations"
                value={counts.pendingVerificationTotal}
                prefix={<SafetyCertificateOutlined />}
                valueStyle={{ color: '#6366f1' }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" className="admin-stat-card">
            {counts.loading ? (
              <Spin />
            ) : (
              <Statistic
                title="Pending provider profiles"
                value={counts.pendingProviderVerifications}
                prefix={<TeamOutlined />}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" className="admin-stat-card">
            {counts.loading ? (
              <Spin />
            ) : (
              <Statistic
                title="Pending company profiles"
                value={counts.pendingCompanyVerifications}
                prefix={<TeamOutlined />}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card variant="borderless" className="admin-stat-card">
            <Statistic
              title="Open reclamations"
              value={counts.openReclamations}
              prefix={<AlertOutlined />}
              valueStyle={{
                color:
                  counts.openReclamations > 0 ? '#ef4444' : undefined,
              }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Connects to the API when the reclamations module is available.
            </Typography.Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
