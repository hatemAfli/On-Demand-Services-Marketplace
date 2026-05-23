import {
  CheckCircleOutlined,
  DeleteOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { ArrowLeft } from 'lucide-react'
import {
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Image,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../../services/api'
import type { AdminUserDetail, AdminUserGivenService } from '../../../../types/admin-user-detail'
import type { AccountStatus, UserRole } from '../../../../types/user'
import './UsersDetailsPage.css'

const { TextArea } = Input

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = dayjs(iso)
  return d.isValid() ? d.format('D MMM YYYY, HH:mm') : '—'
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'CLIENT':
      return 'Client'
    case 'PROVIDER':
      return 'Provider'
    case 'COMPANY_ADMIN':
      return 'Company admin'
    case 'PLATFORM_ADMIN':
      return 'Platform admin'
    default:
      return role
  }
}

function statusColor(status: AccountStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'PENDING':
      return 'warning'
    case 'SUSPENDED':
      return 'magenta'
    case 'REJECTED':
      return 'error'
    case 'DELETED':
      return 'default'
    default:
      return 'default'
  }
}

function initials(first: string, last: string): string {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?'
}

export function UsersDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusModal, setStatusModal] = useState<{
    status: AccountStatus
    title: string
  } | null>(null)
  const [statusReason, setStatusReason] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await api.getAdminUserById(id)
      setUser(res.data)
    } catch (err) {
      message.error(formatApiMessage(err))
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    void load()
  }, [load])

  const applyStatus = async (status: AccountStatus, reason?: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await api.updateAdminUserStatus(id, {
        status,
        reason: reason?.trim() || undefined,
      })
      message.success('Account status updated')
      setStatusModal(null)
      setStatusReason('')
      await load()
    } catch (err) {
      message.error(formatApiMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const openStatusModal = (status: AccountStatus, title: string) => {
    setStatusModal({ status, title })
    setStatusReason('')
  }

  if (loading) {
    return (
      <div className="users-detail users-detail--centered">
        <Spin size="large" />
      </div>
    )
  }

  if (!user || !id) {
    return (
      <div className="users-detail users-detail--centered">
        <p>User not found.</p>
        <Button type="link" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    )
  }

  const isDeleted = user.status === 'DELETED'
  const isPlatformAdmin = user.role === 'PLATFORM_ADMIN'
  const canManage = !isPlatformAdmin && !isDeleted

  const givenServiceColumns: ColumnsType<AdminUserGivenService> = [
    { title: 'Service', dataIndex: 'serviceName', key: 'name' },
    { title: 'Category', dataIndex: 'categoryName', key: 'cat', render: (v) => v ?? '—' },
    {
      title: 'Price',
      key: 'price',
      render: (_, r) => `${r.price} (${r.pricingType})`,
    },
    {
      title: 'Rating',
      key: 'rating',
      render: (_, r) =>
        r.averageRating != null ? `${r.averageRating} ★ (${r.totalReviews ?? 0})` : '—',
    },
    {
      title: 'Active',
      dataIndex: 'active',
      key: 'active',
      render: (a: boolean) => (
        <Tag color={a ? 'success' : 'default'}>{a ? 'Yes' : 'No'}</Tag>
      ),
    },
  ]

  const allDocuments = user.verificationRequests.flatMap((vr) =>
    vr.documents.map((d) => ({
      ...d,
      requestId: vr.id,
      requestStatus: vr.requestStatus,
      serviceName: vr.service?.name ?? 'Company verification',
    })),
  )

  return (
    <div className="users-detail">
      <header className="users-detail__header">
        <button
          type="button"
          className="users-detail__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <Avatar className="users-detail__avatar" size={64}>
          {user.provider?.photoUrl || user.client?.imageUrl ? (
            <img
              src={user.provider?.photoUrl ?? user.client?.imageUrl ?? ''}
              alt=""
            />
          ) : (
            initials(user.firstName, user.lastName)
          )}
        </Avatar>
        <div className="users-detail__header-main">
          <div className="users-detail__title-row">
            <h1 className="users-detail__title">
              {user.firstName} {user.lastName}
            </h1>
            <Tag color="geekblue">{roleLabel(user.role)}</Tag>
            <Tag color={statusColor(user.status)} style={{ fontWeight: 700 }}>
              {user.status}
            </Tag>
          </div>
          <Typography.Text className="users-detail__email" copyable>
            {user.email}
          </Typography.Text>
        </div>
      </header>

      {canManage ? (
        <Card className="users-detail__actions-card" title="Account actions">
          <div className="users-detail__actions-row">
            {user.status !== 'ACTIVE' ? (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={actionLoading}
                onClick={() => openStatusModal('ACTIVE', 'Activate account')}
              >
                Activate
              </Button>
            ) : null}
            {user.status === 'ACTIVE' || user.status === 'PENDING' ? (
              <Button
                icon={<StopOutlined />}
                loading={actionLoading}
                onClick={() => openStatusModal('SUSPENDED', 'Suspend account')}
              >
                Suspend
              </Button>
            ) : null}
            {user.status !== 'REJECTED' && user.status !== 'DELETED' ? (
              <Button
                danger
                icon={<WarningOutlined />}
                loading={actionLoading}
                onClick={() => openStatusModal('REJECTED', 'Block account')}
              >
                Block
              </Button>
            ) : null}
            <Button
              danger
              type="primary"
              icon={<DeleteOutlined />}
              loading={actionLoading}
              onClick={() => openStatusModal('DELETED', 'Delete account permanently')}
            >
              Delete
            </Button>
          </div>
        </Card>
      ) : null}

      {isPlatformAdmin ? (
        <Card className="users-detail__card">
          <Typography.Text type="secondary">
            Platform administrator accounts cannot be modified from this screen.
          </Typography.Text>
        </Card>
      ) : null}

      <Card className="users-detail__card" title="Account overview">
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Phone">
            {user.phoneNumber ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Email verified">
            {user.isEmailVerified ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Phone verified">
            {user.isPhoneVerified ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Joined">
            {formatDate(user.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Last updated">
            {formatDate(user.updatedAt)}
          </Descriptions.Item>
          {user.deletedAt ? (
            <Descriptions.Item label="Deleted at">
              {formatDate(user.deletedAt)}
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </Card>

      {Object.keys(user.stats).length > 0 ? (
        <Card className="users-detail__card" title="Activity">
          <div className="users-detail__stat-grid">
            {user.stats.appointments != null ? (
              <div className="users-detail__stat">
                <strong>{user.stats.appointments}</strong>
                <span>Appointments</span>
              </div>
            ) : null}
            {user.stats.reviews != null ? (
              <div className="users-detail__stat">
                <strong>{user.stats.reviews}</strong>
                <span>Reviews</span>
              </div>
            ) : null}
            {user.stats.complaints != null ? (
              <div className="users-detail__stat">
                <strong>{user.stats.complaints}</strong>
                <span>Complaints</span>
              </div>
            ) : null}
            {user.stats.givenServices != null ? (
              <div className="users-detail__stat">
                <strong>{user.stats.givenServices}</strong>
                <span>Services offered</span>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {user.client ? (
        <Card className="users-detail__card" title="Client profile">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="City">{user.client.city}</Descriptions.Item>
            <Descriptions.Item label="Address">
              {user.client.address ?? '—'}
            </Descriptions.Item>
          </Descriptions>
          {user.client.imageUrl ? (
            <div style={{ marginTop: 12 }}>
              <Image src={user.client.imageUrl} width={120} alt="Profile" />
            </div>
          ) : null}
        </Card>
      ) : null}

      {user.provider ? (
        <Card className="users-detail__card" title="Provider profile">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Type">
              <Tag color={user.provider.type === 'EMPLOYEE' ? 'purple' : 'blue'}>
                {user.provider.type === 'EMPLOYEE' ? 'Employee' : 'Independent'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="City">{user.provider.city}</Descriptions.Item>
            <Descriptions.Item label="Address">
              {user.provider.address ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Experience">
              {user.provider.yearsOfExperience != null
                ? `${user.provider.yearsOfExperience} years`
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Rating">
              {user.provider.averageRating != null
                ? `${user.provider.averageRating} ★ (${user.provider.totalReviews} reviews)`
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Top provider">
              {user.provider.isTopProvider ? 'Yes' : 'No'}
            </Descriptions.Item>
            <Descriptions.Item label="Complaints">
              {user.provider.totalComplaints} total · {user.provider.activeComplaints}{' '}
              active
            </Descriptions.Item>
            <Descriptions.Item label="Languages">
              {user.provider.languagesSpoken.join(', ') || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Payment methods">
              {user.provider.paymentMethodsAccepted.join(', ') || '—'}
            </Descriptions.Item>
          </Descriptions>
          {user.provider.tagline ? (
            <p>
              <strong>Tagline:</strong> {user.provider.tagline}
            </p>
          ) : null}
          {user.provider.bio ? (
            <p className="users-detail__bio">{user.provider.bio}</p>
          ) : null}
          {user.provider.company ? (
            <Card size="small" title="Employer company" style={{ marginTop: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Name">
                  {user.provider.company.companyName}
                </Descriptions.Item>
                <Descriptions.Item label="Tax ID">
                  {user.provider.company.taxId}
                </Descriptions.Item>
                <Descriptions.Item label="City">
                  {user.provider.company.city}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {user.provider.company.email ?? '—'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ) : null}
        </Card>
      ) : null}

      {user.companyAdmin?.company ? (
        <Card className="users-detail__card" title="Company administration">
          <Descriptions column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label="Company">
              {user.companyAdmin.company.companyName}
            </Descriptions.Item>
            <Descriptions.Item label="Tax ID">
              {user.companyAdmin.company.taxId}
            </Descriptions.Item>
            <Descriptions.Item label="City">
              {user.companyAdmin.company.city}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {user.companyAdmin.company.email ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Rating">
              {user.companyAdmin.company.averageRating != null
                ? `${user.companyAdmin.company.averageRating} ★`
                : '—'}
            </Descriptions.Item>
          </Descriptions>
          {user.companyAdmin.company.providers.length > 0 ? (
            <>
              <Typography.Title level={5} style={{ marginTop: 16 }}>
                Employees ({user.companyAdmin.company.providers.length})
              </Typography.Title>
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={user.companyAdmin.company.providers}
                columns={[
                  {
                    title: 'Name',
                    key: 'name',
                    render: (_, r) =>
                      `${r.user.firstName} ${r.user.lastName}`,
                  },
                  { title: 'Email', dataIndex: ['user', 'email'], key: 'email' },
                  { title: 'City', dataIndex: 'city', key: 'city' },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (_, r) => (
                      <Tag color={statusColor(r.user.status)}>{r.user.status}</Tag>
                    ),
                  },
                  {
                    title: '',
                    key: 'link',
                    render: (_, r) => (
                      <Link to={`/admin/users/${r.id}`}>View →</Link>
                    ),
                  },
                ]}
              />
            </>
          ) : (
            <Typography.Text type="secondary">No employees linked yet.</Typography.Text>
          )}
        </Card>
      ) : null}

      {user.platformAdmin ? (
        <Card className="users-detail__card" title="Platform admin">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Permissions">
              {user.platformAdmin.permissions.length > 0
                ? user.platformAdmin.permissions.join(', ')
                : 'Default (full access)'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : null}

      {user.verificationRequests.length > 0 ? (
        <Card className="users-detail__card" title="Verification requests">
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={user.verificationRequests}
            columns={[
              {
                title: 'Service / type',
                key: 'service',
                render: (_, r) => r.service?.name ?? r.ownerType,
              },
              {
                title: 'Status',
                dataIndex: 'requestStatus',
                key: 'status',
                render: (s: string) => <Tag>{s}</Tag>,
              },
              {
                title: 'Submitted',
                dataIndex: 'createdAt',
                key: 'created',
                render: (d: string) => formatDate(d),
              },
              {
                title: 'Documents',
                key: 'docs',
                render: (_, r) => r.documents.length,
              },
              {
                title: '',
                key: 'link',
                render: () => (
                  <Link to="/admin/validations/history">View queue →</Link>
                ),
              },
            ]}
          />
        </Card>
      ) : null}

      {allDocuments.length > 0 ? (
        <Card className="users-detail__card" title="Uploaded documents">
          <Space wrap size="middle">
            {allDocuments.map((d) => (
              <a
                key={d.id}
                href={d.fichierUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="users-detail__doc-link"
              >
                <img
                  src={d.fichierUrl}
                  alt={d.type}
                  className="users-detail__doc-thumb"
                />
                <span>{d.type}</span>
                {d.isAccepted === true ? (
                  <Tag color="success">Accepted</Tag>
                ) : d.isAccepted === false ? (
                  <Tag color="error">Rejected</Tag>
                ) : (
                  <Tag>Pending</Tag>
                )}
              </a>
            ))}
          </Space>
        </Card>
      ) : null}

      {user.givenServices.length > 0 ? (
        <Card className="users-detail__card" title="Given services">
          <Table
            size="small"
            rowKey="id"
            columns={givenServiceColumns}
            dataSource={user.givenServices}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ) : null}

      <Modal
        title={statusModal?.title}
        open={statusModal != null}
        onCancel={() => !actionLoading && setStatusModal(null)}
        onOk={() =>
          statusModal &&
          void applyStatus(statusModal.status, statusReason)
        }
        okText="Confirm"
        okButtonProps={{
          danger: statusModal?.status === 'DELETED' || statusModal?.status === 'REJECTED',
        }}
        confirmLoading={actionLoading}
      >
        <p style={{ marginBottom: 12 }}>
          {statusModal?.status === 'DELETED'
            ? 'This will mark the account as deleted. The user will no longer be able to sign in.'
            : statusModal?.status === 'SUSPENDED'
              ? 'The user will be suspended and cannot use the platform until reactivated.'
              : statusModal?.status === 'REJECTED'
                ? 'The user will be blocked from accessing the platform.'
                : 'The user will be able to access the platform again.'}
        </p>
        <TextArea
          rows={3}
          placeholder="Optional internal reason (recommended)…"
          value={statusReason}
          onChange={(e) => setStatusReason(e.target.value)}
          maxLength={2000}
        />
      </Modal>
    </div>
  )
}
