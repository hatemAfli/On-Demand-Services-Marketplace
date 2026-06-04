import { EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../../services/api'
import type {
  SupportMessageItem,
  SupportMessageStatus,
} from '../../../../types/support'
import './SupportMessagesAdminPage.css'

const STATUSES: SupportMessageStatus[] = ['NEW', 'READ', 'ARCHIVED']

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function statusColor(status: SupportMessageStatus) {
  if (status === 'NEW') return 'processing'
  if (status === 'READ') return 'success'
  return 'default'
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function SupportMessagesAdminPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<SupportMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<SupportMessageStatus | undefined>()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SupportMessageItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminSupportMessages({
        status: statusFilter,
        search: search.trim() || undefined,
      })
      setRows(res.data)
    } catch (e) {
      message.error(formatApiMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [message, search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (row: SupportMessageItem) => {
    try {
      const res = await api.getAdminSupportMessage(row.id)
      setSelected(res.data)
      setDrawerOpen(true)
      if (res.data.status === 'NEW') {
        const updated = await api.updateAdminSupportMessageStatus(row.id, {
          status: 'READ',
        })
        setSelected(updated.data)
        setRows((prev) =>
          prev.map((item) => (item.id === row.id ? updated.data : item)),
        )
      }
    } catch (e) {
      message.error(formatApiMessage(e))
    }
  }

  const updateStatus = async (status: SupportMessageStatus) => {
    if (!selected) return
    setUpdating(true)
    try {
      const res = await api.updateAdminSupportMessageStatus(selected.id, { status })
      setSelected(res.data)
      setRows((prev) => prev.map((item) => (item.id === selected.id ? res.data : item)))
      message.success('Status updated')
    } catch (e) {
      message.error(formatApiMessage(e))
    } finally {
      setUpdating(false)
    }
  }

  const columns: ColumnsType<SupportMessageItem> = [
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: SupportMessageStatus) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: 'From',
      render: (_, row) => (
        <div>
          <Typography.Text strong>{row.name}</Typography.Text>
          <div className="support-msg-sub">{row.email}</div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'userRole',
      width: 110,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
    },
    {
      title: 'Received',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => formatDate(v),
    },
    {
      title: '',
      width: 70,
      render: (_, row) => (
        <Button type="text" icon={<EyeOutlined />} onClick={() => void openDetail(row)} />
      ),
    },
  ]

  return (
    <div className="support-messages-page">
      <div className="support-messages-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Messages & Support
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Contact requests submitted by clients and providers from the mobile app.
          </Typography.Paragraph>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Filter by status"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Input.Search
          allowClear
          placeholder="Search name, email, subject..."
          style={{ width: 320 }}
          onSearch={(v) => setSearch(v)}
        />
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} />

      <Drawer
        title="Contact message"
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        {selected ? (
          <div className="support-message-detail">
            <Space style={{ marginBottom: 16 }}>
              <Tag color={statusColor(selected.status)}>{selected.status}</Tag>
              <Select
                value={selected.status}
                style={{ width: 140 }}
                loading={updating}
                onChange={(v) => void updateStatus(v)}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </Space>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Name">{selected.name}</Descriptions.Item>
              <Descriptions.Item label="Email">{selected.email}</Descriptions.Item>
              <Descriptions.Item label="Role">{selected.userRole}</Descriptions.Item>
              <Descriptions.Item label="Account">
                {selected.user.firstName} {selected.user.lastName} ({selected.user.email})
              </Descriptions.Item>
              <Descriptions.Item label="Subject">{selected.subject}</Descriptions.Item>
              <Descriptions.Item label="Received">
                {formatDate(selected.createdAt)}
              </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginTop: 20 }}>
              Message
            </Typography.Title>
            <div className="support-message-body">{selected.message}</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
