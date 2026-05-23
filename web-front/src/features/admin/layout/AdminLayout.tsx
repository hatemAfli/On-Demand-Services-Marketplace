import { Layout, Menu, Typography, Button, theme } from 'antd'
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { AdminOutletContext } from './adminOutletContext'
import { buildAdminMenuItems } from './adminMenu'
import { useAdminQueueCounts } from '../../../hooks/useAdminQueueCounts'
import { authService } from '../../../services/auth.service'
import { useAuthStore } from '../../../stores/authStore'
import './AdminLayout.css'

const { Header, Sider, Content } = Layout

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [collapsed, setCollapsed] = useState(false)

  const counts = useAdminQueueCounts()

  const items = useMemo(
    () =>
      buildAdminMenuItems({
        pendingVerificationTotal: counts.pendingVerificationTotal,
        pendingProviderVerifications: counts.pendingProviderVerifications,
        pendingCompanyVerifications: counts.pendingCompanyVerifications,
        openReclamations: counts.openReclamations,
      }),
    [
      counts.pendingVerificationTotal,
      counts.pendingProviderVerifications,
      counts.pendingCompanyVerifications,
      counts.openReclamations,
    ],
  )

  const onMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key.startsWith('/')) navigate(key)
    },
    [navigate],
  )

  const logout = async () => {
    await authService.logout()
    setUser(null)
    navigate('/login', { replace: true })
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email ?? 'Admin'

  return (
    <Layout className="admin-root" style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={268}
        className="admin-sider"
      >
        <div className="admin-sider-brand">
          {!collapsed ? (
            <>
              <div className="admin-sider-logo">SP</div>
              <div>
                <Typography.Text className="admin-sider-title">
                  Service Platform
                </Typography.Text>
                <Typography.Text type="secondary" className="admin-sider-sub">
                  Administration
                </Typography.Text>
              </div>
            </>
          ) : (
            <div className="admin-sider-logo">SP</div>
          )}
        </div>
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={[
            'sub-users',
            'sub-validation',
            'sub-catalog',
            'sub-finance',
            'sub-analytics',
            'sub-content',
            'sub-settings',
          ]}
          items={items}
          onClick={onMenuClick}
          className="admin-menu"
        />
        <div className="admin-sider-footer">
          <div className="admin-user-block">
            <Typography.Text className="admin-user-name">
              {displayName}
            </Typography.Text>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={() => void logout()}
              className="admin-logout"
            >
              {!collapsed ? 'Logout' : ''}
            </Button>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header
          className="admin-header"
          style={{
            padding: '0 20px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          />
          <Typography.Title level={5} style={{ margin: 0, flex: 1 }}>
            Platform console
          </Typography.Title>
        </Header>
        <Content className="admin-content">
          <Outlet context={counts satisfies AdminOutletContext} />
        </Content>
      </Layout>
    </Layout>
  )
}
