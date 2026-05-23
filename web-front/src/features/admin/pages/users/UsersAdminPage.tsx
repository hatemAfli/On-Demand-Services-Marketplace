import { ReloadOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import {
  App,
  Avatar,
  Button,
  Card,
  Input,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../../../services/api'
import type { AdminUserListItem } from '../../../../types/admin-user'
import type { AccountStatus, UserRole } from '../../../../types/user'
import './UsersAdminPage.css'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350

type SegmentValue = 'all' | UserRole

const PATH_BY_SEGMENT: Record<SegmentValue, string> = {
  all: '/admin/users/all',
  CLIENT: '/admin/users/clients',
  PROVIDER: '/admin/users/providers',
  COMPANY_ADMIN: '/admin/users/company-admins',
  PLATFORM_ADMIN: '/admin/users/platform-admins',
}

const SEGMENT_BY_PATH: Record<string, SegmentValue> = {
  '/admin/users/all': 'all',
  '/admin/users/clients': 'CLIENT',
  '/admin/users/providers': 'PROVIDER',
  '/admin/users/company-admins': 'COMPANY_ADMIN',
  '/admin/users/platform-admins': 'PLATFORM_ADMIN',
}

function segmentFromPathname(pathname: string): SegmentValue {
  const key = pathname.replace(/\/$/, '')
  return SEGMENT_BY_PATH[key] ?? 'all'
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function roleTag(role: UserRole): { color: string; label: string } {
  switch (role) {
    case 'CLIENT':
      return { color: 'gold', label: 'Client' }
    case 'PROVIDER':
      return { color: 'blue', label: 'Provider' }
    case 'COMPANY_ADMIN':
      return { color: 'purple', label: 'Company admin' }
    case 'PLATFORM_ADMIN':
      return { color: 'geekblue', label: 'Platform admin' }
    default:
      return { color: 'default', label: role }
  }
}

function statusTag(status: AccountStatus): { color: string } {
  switch (status) {
    case 'ACTIVE':
      return { color: 'success' }
    case 'PENDING':
      return { color: 'warning' }
    case 'REJECTED':
      return { color: 'error' }
    case 'SUSPENDED':
      return { color: 'magenta' }
    case 'DELETED':
      return { color: 'default' }
    default:
      return { color: 'default' }
  }
}

function userInitials(u: AdminUserListItem): string {
  const a = (u.firstName || '').trim().charAt(0)
  const b = (u.lastName || '').trim().charAt(0)
  const s = `${a}${b}`.toUpperCase()
  return s || '?'
}

export function UsersAdminPage() {
  const { message } = App.useApp()
  const location = useLocation()
  const navigate = useNavigate()

  const segment = useMemo(
    () => segmentFromPathname(location.pathname),
    [location.pathname],
  )

  const apiRole: UserRole | undefined =
    segment === 'all' ? undefined : segment

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AdminUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
    setSearchInput('')
    setSearchQuery('')
  }, [segment])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminUsers({
        role: apiRole,
        search: searchQuery || undefined,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      })
      const { items: rows, total: count } = res.data
      setItems(rows ?? [])
      setTotal(count ?? 0)
    } catch (e) {
      message.error(formatApiMessage(e))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [apiRole, page, searchQuery, message])

  useEffect(() => {
    void load()
  }, [load])

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize: PAGE_SIZE,
    total,
    showSizeChanger: false,
    showTotal: (t) => `${t} users`,
    onChange: (p) => setPage(p),
  }

  const segmentOptions = useMemo(
    () => [
      { label: 'All', value: 'all' as const },
      { label: 'Clients', value: 'CLIENT' as const },
      { label: 'Providers', value: 'PROVIDER' as const },
      { label: 'Company admins', value: 'COMPANY_ADMIN' as const },
      { label: 'Platform admins', value: 'PLATFORM_ADMIN' as const },
    ],
    [],
  )

  const onSegmentChange = (val: SegmentValue) => {
    navigate(PATH_BY_SEGMENT[val])
  }

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'User',
      key: 'user',
      width: 280,
      render: (_, u) => {
        const name =
          `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—'
        const rt = roleTag(u.role)
        return (
          <div className="users-admin-name-cell">
            <Avatar className="users-admin-avatar" size={44} style={{ background: '#6366f1' }}>
              {userInitials(u)}
            </Avatar>
            <div>
              <Typography.Text strong style={{ display: 'block', color: '#0f172a' }}>
                {name}
              </Typography.Text>
              <Tag color={rt.color} style={{ marginTop: 4, fontWeight: 700 }}>
                {rt.label}
              </Tag>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (email: string) => (
        <Tooltip title={email}>
          <Typography.Text
            copyable={{ text: email }}
            onClick={(e) => e.stopPropagation()}
          >
            {email}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phoneNumber',
      key: 'phone',
      width: 140,
      render: (p: string | null) =>
        p ? (
          <Typography.Text
            copyable={{ text: p }}
            onClick={(e) => e.stopPropagation()}
          >
            {p}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: AccountStatus) => {
        const { color } = statusTag(s)
        return (
          <Tag color={color} style={{ fontWeight: 700 }}>
            {s}
          </Tag>
        )
      },
    },
    {
      title: 'Verified',
      key: 'verified',
      width: 120,
      render: (_, u) => (
        <Space size={4} wrap>
          <Tag color={u.isEmailVerified ? 'success' : 'default'}>
            Email{u.isEmailVerified ? ' ✓' : ''}
          </Tag>
          <Tag color={u.isPhoneVerified ? 'success' : 'default'}>
            Phone{u.isPhoneVerified ? ' ✓' : ''}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Joined',
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

  const filterLabel =
    segment === 'all'
      ? 'All roles'
      : roleTag(segment as UserRole).label + 's'

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="users-admin">
      <div className="users-admin-hero">
        <div className="users-admin-hero-inner">
          <div className="users-admin-kicker">User management</div>
          <Typography.Title level={2} className="users-admin-title">
            Directory
          </Typography.Title>
          <p className="users-admin-subtitle">
            Browse accounts across the platform. Filter by role and search by name,
            email, or phone — results are loaded from the full database.
          </p>
          <div className="users-admin-stats">
            <span className="users-admin-stat-pill">
              <TeamOutlined style={{ color: '#6366f1' }} />
              {searchQuery ? (
                <>
                  <strong>{total}</strong> match{total === 1 ? '' : 'es'}
                  {segment !== 'all' ? ` · ${filterLabel}` : ''}
                </>
              ) : (
                <>
                  <strong>{total}</strong> total
                  {segment !== 'all' ? ` · ${filterLabel}` : ''}
                  {total > 0 ? (
                    <>
                      {' '}
                      · showing {rangeStart}–{rangeEnd}
                    </>
                  ) : null}
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <Card className="users-admin-card" variant="borderless">
        <div className="users-admin-toolbar">
          <div className="users-admin-toolbar-left">
            <Segmented<SegmentValue>
              value={segment}
              onChange={onSegmentChange}
              options={segmentOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <Input
            className="users-admin-search"
            allowClear
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Search name, email, or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <Spin spinning={loading}>
          <Table<AdminUserListItem>
            className="users-admin-table"
            rowKey="id"
            columns={columns}
            dataSource={items}
            pagination={pagination}
            scroll={{ x: 960 }}
            onRow={(record) => ({
              onClick: () => navigate(`/admin/users/${record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        </Spin>
      </Card>
    </div>
  )
}
