import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../../../services/auth.service'
import { useAuthStore } from '../../../../stores/authStore'
import './LoginPage.css'

export function LoginPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const { user, homePath } = await authService.loginWithEmail(
        values.email.trim(),
        values.password,
      )
      setUser(user)
      message.success('Welcome back')
      navigate(homePath, { replace: true })
    } catch (e) {
      message.error((e as Error).message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden />
      <div className="login-grid" aria-hidden />
      <Card className="login-card" bordered={false}>
        <div className="login-card-header">
          <div className="login-card-logo">SP</div>
          <Typography.Title level={3} className="login-card-title">
            Administration login
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="login-card-desc">
            Sign in with your platform admin or company admin account. Client and
            provider accounts continue on mobile only.
          </Typography.Paragraph>
        </div>
        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={onFinish}
          className="login-form"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input
              size="large"
              prefix={<MailOutlined className="login-input-icon" />}
              placeholder="admin@example.com"
              autoComplete="email"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined className="login-input-icon" />}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              className="login-submit"
            >
              Sign in
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
