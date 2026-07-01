import { ArrowLeftOutlined, RobotOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Descriptions,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { adminApi } from '../../../../services/adminApi'
import type { AdminChatbotSessionDetail } from '../../../../types/chatbot-admin'
import './AdminChatbotSessionsPage.css'

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function providerSummary(providers: unknown[]): string {
  if (!providers.length) return ''
  const names = providers
    .slice(0, 3)
    .map((p) => {
      const row = p as Record<string, unknown>
      return (
        (row.provider_name as string) ||
        (row.service_name as string) ||
        'Provider'
      )
    })
    .filter(Boolean)
  const extra = providers.length > 3 ? ` +${providers.length - 3} more` : ''
  return `${names.join(', ')}${extra}`
}

export function AdminChatbotSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { message } = App.useApp()
  const [detail, setDetail] = useState<AdminChatbotSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await adminApi.getAdminChatbotSession(sessionId)
      setDetail(res.data)
    } catch (e) {
      message.error(formatApiMessage(e))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [message, sessionId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="chatbot-detail-page">
        <Typography.Text type="secondary">Session not found.</Typography.Text>
      </div>
    )
  }

  const clientName =
    [detail.client.firstName, detail.client.lastName].filter(Boolean).join(' ') ||
    detail.client.email

  return (
    <div className="chatbot-detail-page">
      <div className="chatbot-detail-header">
        <Link to="/admin/chatbot">
          <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingLeft: 0 }}>
            Back to conversations
          </Button>
        </Link>
        <div className="chatbot-admin-hero">
          <div className="chatbot-admin-hero-icon">
            <RobotOutlined />
          </div>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {detail.session.title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              {detail.messages.length} messages · Updated{' '}
              {formatDate(detail.session.updatedAt)}
            </Typography.Paragraph>
          </div>
        </div>
      </div>

      <Card size="small" style={{ marginBottom: 20, borderRadius: 14 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Client">{clientName}</Descriptions.Item>
          <Descriptions.Item label="Email">{detail.client.email}</Descriptions.Item>
          <Descriptions.Item label="City">{detail.client.city ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Phone">
            {detail.client.phoneNumber ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Locale">
            <Tag>{detail.session.locale.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Started">
            {formatDate(detail.session.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            {detail.session.deletedAt ? (
              <Tag color="default">Deleted by client</Tag>
            ) : (
              <Tag color="success">Active</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Conversation thread" style={{ borderRadius: 14 }}>
        <div className="chatbot-thread">
          {detail.messages.map((msg) => (
            <div key={msg.id} className={`chatbot-bubble ${msg.role}`}>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {msg.role === 'user' ? 'Client' : 'Assistant'} ·{' '}
                {formatDate(msg.createdAt)}
              </Typography.Text>
              <p className="chatbot-bubble-text">{msg.text}</p>
              {msg.role === 'assistant' ? (
                <>
                  <div className="chatbot-bubble-meta">
                    {msg.fallback ? <Tag color="warning">Fallback</Tag> : null}
                    {msg.errorCode ? (
                      <Tag color="error">{msg.errorCode}</Tag>
                    ) : null}
                    {msg.intentDetected === false ? (
                      <Tag color="orange">Intent unclear</Tag>
                    ) : null}
                    {msg.latencyMs != null ? (
                      <Tag>{msg.latencyMs} ms</Tag>
                    ) : null}
                    {msg.providers?.length ? (
                      <Tag color="blue">{msg.providers.length} providers</Tag>
                    ) : null}
                  </div>
                  {msg.providers?.length ? (
                    <div className="chatbot-providers-preview">
                      Shown to client: {providerSummary(msg.providers)}
                    </div>
                  ) : null}
                  {msg.suggestions?.length ? (
                    <div className="chatbot-bubble-meta">
                      <Tag>Suggestions: {msg.suggestions.join(' · ')}</Tag>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
