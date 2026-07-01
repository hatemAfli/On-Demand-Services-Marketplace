import { EyeOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../../../services/adminApi'
import type {
  AdminChatbotSessionListItem,
  AdminChatbotStats,
} from '../../../../types/chatbot-admin'
import './AdminChatbotSessionsPage.css'

const PAGE_SIZE = 20

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

function clientName(row: AdminChatbotSessionListItem) {
  const n = [row.client.firstName, row.client.lastName].filter(Boolean).join(' ')
  return n.trim() || row.client.email
}

export function AdminChatbotSessionsPage() {
  const { message } = App.useApp()
  const [stats, setStats] = useState<AdminChatbotStats | null>(null)
  const [rows, setRows] = useState<AdminChatbotSessionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [locale, setLocale] = useState<string | undefined>()
  const [hasFallback, setHasFallback] = useState(false)
  const [includeDeleted, setIncludeDeleted] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      const res = await adminApi.getChatbotStats()
      setStats(res.data)
    } catch {
      setStats(null)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getAdminChatbotSessions({
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
        search: search.trim() || undefined,
        locale,
        hasFallback: hasFallback || undefined,
        includeDeleted: includeDeleted || undefined,
      })
      setRows(res.data.items)
      setTotal(res.data.total)
    } catch (e) {
      message.error(formatApiMessage(e))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [hasFallback, includeDeleted, locale, message, page, search])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ColumnsType<AdminChatbotSessionListItem> = [
    {
      title: 'Conversation',
      key: 'title',
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.title}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.messageCount} messages
              {row.fallbackCount > 0 ? ` · ${row.fallbackCount} fallback` : ''}
            </Typography.Text>
          </div>
          {row.deletedAt ? (
            <Tag color="default" style={{ marginTop: 4 }}>
              Deleted by client
            </Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Client',
      key: 'client',
      render: (_, row) => (
        <div>
          <Typography.Text>{clientName(row)}</Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.client.email}
              {row.client.city ? ` · ${row.client.city}` : ''}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Locale',
      dataIndex: 'locale',
      width: 80,
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Last activity',
      dataIndex: 'updatedAt',
      width: 170,
      render: (v: string) => formatDate(v),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, row) => (
        <Link to={`/admin/chatbot/${row.sessionId}`}>
          <Button type="link" icon={<EyeOutlined />}>
            Review
          </Button>
        </Link>
      ),
    },
  ]

  const onTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1)
  }

  return (
    <div className="chatbot-admin-page">
      <div className="chatbot-admin-hero">
        <div className="chatbot-admin-hero-icon">
          <RobotOutlined />
        </div>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            AI Chatbot conversations
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
            Review every client discussion, monitor fallback rates, latency, and
            errors to keep the assistant reliable.
          </Typography.Paragraph>
        </div>
      </div>

      {stats ? (
        <Row gutter={[16, 16]} className="chatbot-admin-stats">
          <Col xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic title="Total sessions" value={stats.totalSessions} />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic title="Total messages" value={stats.totalMessages} />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic title="Sessions (24h)" value={stats.sessionsLast24h} />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic title="Messages (24h)" value={stats.messagesLast24h} />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic
                title="Fallback rate"
                value={stats.fallbackRatePercent}
                suffix="%"
                valueStyle={
                  stats.fallbackRatePercent > 25
                    ? { color: '#dc2626' }
                    : undefined
                }
              />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card size="small">
              <Statistic
                title="Errors logged"
                value={stats.errorCount}
                valueStyle={
                  stats.errorCount > 0 ? { color: '#dc2626' } : undefined
                }
              />
            </Card>
          </Col>
        </Row>
      ) : null}

      <Card className="chatbot-admin-table-card">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder="Search title, client name, email…"
            style={{ width: 280 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(v) => {
              setPage(1)
              setSearch(v)
            }}
          />
          <Select
            allowClear
            placeholder="Locale"
            style={{ width: 120 }}
            value={locale}
            onChange={(v) => {
              setPage(1)
              setLocale(v)
            }}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'Arabic' },
            ]}
          />
          <Space>
            <Switch
              checked={hasFallback}
              onChange={(v) => {
                setPage(1)
                setHasFallback(v)
              }}
            />
            <Typography.Text>Fallback only</Typography.Text>
          </Space>
          <Space>
            <Switch
              checked={includeDeleted}
              onChange={(v) => {
                setPage(1)
                setIncludeDeleted(v)
              }}
            />
            <Typography.Text>Include deleted</Typography.Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Refresh
          </Button>
        </Space>

        <Table
          rowKey="sessionId"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
          }}
          onChange={onTableChange}
        />
      </Card>
    </div>
  )
}
