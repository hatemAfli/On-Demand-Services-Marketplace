import { Layout, Menu, Typography, Button, theme } from 'antd'
import {
  AppstoreOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { authService } from '../../../services/auth.service'
import { useAuthStore } from '../../../stores/authStore'

const { Header, Sider, Content } = Layout

const items = [
  { key: '/company/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/company/services', icon: <AppstoreOutlined />, label: 'Company services' },
  { key: '/company/team', icon: <TeamOutlined />, label: 'Team & permissions' },
]

export function CompanyAdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [collapsed, setCollapsed] = useState(false)

  const logout = async () => {
    await authService.logout()
    setUser(null)
    navigate('/login', { replace: true })
  }

  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.email ?? 'Company admin'

  return (
    <Layout className="admin-root" style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={260}
        className="admin-sider"
      >
        <div className="admin-sider-brand">
          {!collapsed ? (
            <>
              <div className="admin-sider-logo">CO</div>
              <div>
                <Typography.Text className="admin-sider-title">
                  Company Console
                </Typography.Text>
                <Typography.Text type="secondary" className="admin-sider-sub">
                  Admin workspace
                </Typography.Text>
              </div>
            </>
          ) : (
            <div className="admin-sider-logo">CO</div>
          )}
        </div>
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[location.pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
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
            Company admin console
          </Typography.Title>
        </Header>
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
