import {
  BankOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../../../../services/api'
import type { AdminOutletContext } from '../../layout/adminOutletContext'
import type {
  AdminVerificationRequestItem,
  VerificationOwnerType,
  VerificationReviewStatus,
} from '../../../../types/verification-admin'
import { VerificationRequestDrawer } from './VerificationRequestDrawer'
import '../users/UsersAdminPage.css'

const QUEUE_STATUSES: VerificationReviewStatus[] = ['PENDING', 'UNDER_REVIEW']

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function statusTagColor(s: VerificationReviewStatus): string {
  switch (s) {
    case 'PENDING':
      return 'gold'
    case 'UNDER_REVIEW':
      return 'blue'
    default:
      return 'default'
  }
}

export type ValidationsQueuePageProps = {
  ownerType: VerificationOwnerType
  heroKicker: string
  heroTitle: string
  heroSubtitle: string
}

export function ValidationsQueuePage({
  ownerType,
  heroKicker,
  heroTitle,
  heroSubtitle,
}: ValidationsQueuePageProps) {
  const { message } = App.useApp()
  const { refresh: refreshQueueCounts } = useOutletContext<AdminOutletContext>()
  const [loading, setLoading] = useState(true)
  const [rawItems, setRawItems] = useState<AdminVerificationRequestItem[]>([])
  const [search, setSearch] = useState('')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminVerificationRequests({
        ownerType,
        take: 200,
        skip: 0,
      })
      const items = (res.data.items ?? []).filter((r) =>
        QUEUE_STATUSES.includes(r.requestStatus),
      )
      setRawItems(items)
    } catch (e) {
      message.error(formatApiMessage(e))
      setRawItems([])
    } finally {
      setLoading(false)
    }
  }, [ownerType, message])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rawItems
    return rawItems.filter((row) => {
      const name = `${row.user.firstName} ${row.user.lastName}`.toLowerCase()
      const email = row.user.email.toLowerCase()
      const company = row.user.companyAdmin?.company?.companyName?.toLowerCase() ?? ''
      const service = row.service?.name?.toLowerCase() ?? ''
      return (
        name.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        service.includes(q)
      )
    })
  }, [rawItems, search])

  const onAfterMutation = useCallback(() => {
    void load()
    void refreshQueueCounts()
  }, [load, refreshQueueCounts])

  const columns: ColumnsType<AdminVerificationRequestItem> = [
    {
      title: 'Applicant',
      key: 'applicant',
      render: (_, row) => {
        const name =
          `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim() || '—'
        return (
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {row.user.email}
              </Typography.Text>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Context',
      key: 'ctx',
      width: 260,
      ellipsis: true,
      render: (_, row) => {
        if (row.ownerType === 'COMPANY' && row.user.companyAdmin?.company) {
          return (
            <Space>
              <Tag color="purple" icon={<BankOutlined />}>
                Company
              </Tag>
              <span>{row.user.companyAdmin.company.companyName}</span>
            </Space>
          )
        }
        if (row.service) {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="blue" icon={<SolutionOutlined />}>
                Provider
              </Tag>
              <Typography.Text ellipsis style={{ maxWidth: 220 }}>
                {row.service.name}
              </Typography.Text>
            </Space>
          )
        }
        return (
          <Tag color="blue" icon={<SolutionOutlined />}>
            Provider
          </Tag>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'requestStatus',
      width: 140,
      render: (s: VerificationReviewStatus) => (
        <Tag color={statusTagColor(s)}>{s}</Tag>
      ),
    },
    {
      title: 'Docs',
      key: 'docs',
      width: 72,
      align: 'center',
      render: (_, row) => row.documents.length,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      width: 120,
      render: (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
    },
  ]

  return (
    <div className="users-admin">
      <div className="users-admin-hero">
        <div className="users-admin-hero-inner">
          <div className="users-admin-kicker">{heroKicker}</div>
          <Typography.Title level={2} className="users-admin-title">
            {heroTitle}
          </Typography.Title>
          <p className="users-admin-subtitle">{heroSubtitle}</p>
          <div className="users-admin-stats">
            <span className="users-admin-stat-pill">
              <SafetyCertificateOutlined style={{ color: '#d97706' }} />
              <strong>{filtered.length}</strong> in queue
              {search.trim() ? ' (filtered)' : ''}
            </span>
          </div>
        </div>
      </div>

      <Card className="users-admin-card" variant="borderless">
        <div className="users-admin-toolbar">
          <div className="users-admin-toolbar-left">
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <Input
            className="users-admin-search"
            allowClear
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search name, email, company, or service…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Spin spinning={loading}>
          <Table<AdminVerificationRequestItem>
            className="users-admin-table"
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 12, showSizeChanger: false }}
            locale={{
              emptyText: loading ? (
                <span />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No pending requests in this queue"
                />
              ),
            }}
            onRow={(record) => ({
              onClick: () => {
                setDrawerId(record.id)
                setDrawerOpen(true)
              },
              style: { cursor: 'pointer' },
            })}
            scroll={{ x: 900 }}
          />
        </Spin>
      </Card>

      <VerificationRequestDrawer
        open={drawerOpen}
        requestId={drawerId}
        onClose={() => {
          setDrawerOpen(false)
          setDrawerId(null)
        }}
        onAfterMutation={onAfterMutation}
      />
    </div>
  )
}
