import {
  BankOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  App,
  Alert,
  Avatar,
  Button,
  Card,
  Input,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../../services/api'
import type { AdminCompanyListItem } from '../../../../types/admin-company'
import type { AccountStatus } from '../../../../types/user'
import '../users/UsersAdminPage.css'

const PAGE_SIZE = 20
const FETCH_CAP = 500

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function accountStatusColor(status: AccountStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
      return 'error'
    case 'SUSPENDED':
      return 'magenta'
    case 'DELETED':
      return 'default'
    default:
      return 'default'
  }
}

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

export function CompaniesAdminPage() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AdminCompanyListItem[]>([])
  const [totalFromApi, setTotalFromApi] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminCompanies({ skip: 0, take: FETCH_CAP })
      const { items: rows, total } = res.data
      setItems(rows ?? [])
      setTotalFromApi(total ?? 0)
    } catch (e) {
      message.error(formatApiMessage(e))
      setItems([])
      setTotalFromApi(0)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => {
      const adminName = c.adminUser
        ? `${c.adminUser.firstName} ${c.adminUser.lastName}`.toLowerCase()
        : ''
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.taxId.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.adminUser && c.adminUser.email.toLowerCase().includes(q)) ||
        adminName.includes(q)
      )
    })
  }, [items, search])

  const pagedData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize: PAGE_SIZE,
    total: filtered.length,
    showSizeChanger: false,
    showTotal: (t) => `${t} companies`,
    onChange: (p) => setPage(p),
  }

  const truncatedTotal = totalFromApi > FETCH_CAP

  const columns: ColumnsType<AdminCompanyListItem> = [
    {
      title: 'Company',
      key: 'company',
      width: 280,
      render: (_, c) => (
        <div className="users-admin-name-cell">
          <Avatar
            className="users-admin-avatar"
            size={44}
            style={{ background: '#7c3aed', color: '#fff' }}
          >
            {companyInitials(c.companyName)}
          </Avatar>
          <div>
            <Typography.Text strong style={{ display: 'block', color: '#0f172a' }}>
              {c.companyName}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Tax ID: {c.taxId}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'loc',
      width: 160,
      ellipsis: true,
      render: (_, c) => (
        <Tooltip title={[c.city, c.address].filter(Boolean).join(' · ') || c.city}>
          <span>{c.city}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Company email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (em: string | null) =>
        em ? (
          <Typography.Text copyable={{ text: em }}>{em}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Primary admin',
      key: 'admin',
      width: 220,
      render: (_, c) => {
        if (!c.adminUser) {
          return <Typography.Text type="secondary">Not linked</Typography.Text>
        }
        const name =
          `${c.adminUser.firstName} ${c.adminUser.lastName}`.trim() || '—'
        return (
          <div>
            <Typography.Text strong style={{ display: 'block' }}>
              {name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }} copyable>
              {c.adminUser.email}
            </Typography.Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={accountStatusColor(c.adminUser.status)}>
                {c.adminUser.status}
              </Tag>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Providers',
      dataIndex: 'providersCount',
      key: 'providersCount',
      width: 100,
      align: 'center',
      render: (n: number) => (
        <Tag icon={<TeamOutlined />} color="blue">
          {n}
        </Tag>
      ),
    },
    {
      title: 'Rating',
      key: 'rating',
      width: 100,
      render: (_, c) => (
        <span>
          {c.averageRating != null ? c.averageRating.toFixed(2) : '—'}
          <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
            ({c.totalReviews})
          </Typography.Text>
        </span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (iso: string) => {
        try {
          return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        } catch {
          return iso
        }
      },
    },
  ]

  return (
    <div className="users-admin">
      <div className="users-admin-hero">
        <div className="users-admin-hero-inner">
          <div className="users-admin-kicker">Organizations</div>
          <Typography.Title level={2} className="users-admin-title">
            Companies
          </Typography.Title>
          <p className="users-admin-subtitle">
            Legal entities on the platform, their primary admin contact, team size,
            and public ratings. Search filters the loaded directory.
          </p>
          <div className="users-admin-stats">
            <span className="users-admin-stat-pill">
              <BankOutlined style={{ color: '#7c3aed' }} />
              Showing <strong>{filtered.length}</strong>
              {search.trim() ? ' matched' : ' loaded'}
            </span>
            {!search.trim() && totalFromApi > 0 ? (
              <span className="users-admin-stat-pill">
                Total registered: <strong>{totalFromApi}</strong>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Card className="users-admin-card" variant="borderless">
        {truncatedTotal ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Showing up to ${FETCH_CAP} companies per request. Total in database: ${totalFromApi}.`}
          />
        ) : null}

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
            placeholder="Search name, tax ID, city, email, or admin…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Spin spinning={loading}>
          <Table<AdminCompanyListItem>
            className="users-admin-table"
            rowKey="id"
            columns={columns}
            dataSource={pagedData}
            pagination={pagination}
            scroll={{ x: 1100 }}
          />
        </Spin>
      </Card>
    </div>
  )
}
