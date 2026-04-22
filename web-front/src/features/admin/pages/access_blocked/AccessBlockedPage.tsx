import { App, Button, Card, Typography } from 'antd'
import { authService } from '../../../../services/auth.service'
import { useAuthStore } from '../../../../stores/authStore'

export function AccessBlockedPage() {
  const { message } = App.useApp()
  const setUser = useAuthStore((s) => s.setUser)

  const backToLogin = async () => {
    await authService.logout()
    setUser(null)
    message.info('Please sign in with a web-allowed admin account.')
    window.location.assign('/login')
  }

  return (
    <Card style={{ maxWidth: 720 }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Mobile app only account
      </Typography.Title>
      <Typography.Paragraph>
        This web console is reserved for <strong>platform admins</strong> and
        <strong> company admins</strong>. Client and provider roles must sign in
        from the mobile app.
      </Typography.Paragraph>
      <Button type="primary" onClick={() => void backToLogin()}>
        Back to login
      </Button>
    </Card>
  )
}
