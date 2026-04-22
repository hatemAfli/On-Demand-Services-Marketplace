import {
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../../services/api'
import type {
  AdminVerificationRequestItem,
  VerificationReviewStatus,
} from '../../../../types/verification-admin'
import '../users/UsersAdminPage.css'

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    IDENTITY: 'Identity',
    LICENSE: 'License',
    QUALIFICATION: 'Qualification',
    INSURANCE: 'Insurance',
    OTHER: 'Other',
  }
  return map[type] ?? type
}

/** Same presets as mobile admin validation detail (`AdminValidationProviderDetailScreen`). */
const REJECT_PRESET_LABELS = [
  'Incomplete or missing information',
  'Document illegible or low quality',
  'Wrong document type for this category',
  'Expired or out-of-date document',
  'Does not match registered profile information',
] as const

function statusColor(s: VerificationReviewStatus): string {
  switch (s) {
    case 'PENDING':
      return 'gold'
    case 'UNDER_REVIEW':
      return 'blue'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'error'
    default:
      return 'default'
  }
}

type Props = {
  open: boolean
  requestId: string | null
  onClose: () => void
  /** Called after approve / reject / mark review so lists and sidebar badges refresh */
  onAfterMutation: () => void
}

export function VerificationRequestDrawer({
  open,
  requestId,
  onClose,
  onAfterMutation,
}: Props) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<AdminVerificationRequestItem | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectPreset, setRejectPreset] = useState<string | null>(null)
  const [rejectCustom, setRejectCustom] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!requestId) return
    setLoading(true)
    try {
      const res = await api.getAdminVerificationRequest(requestId)
      setDetail(res.data)
    } catch (e) {
      message.error(formatApiMessage(e))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [requestId, message])

  useEffect(() => {
    if (open && requestId) {
      void load()
    } else {
      setDetail(null)
      setRejectPreset(null)
      setRejectCustom('')
    }
  }, [open, requestId, load])

  const runMutation = async (fn: () => Promise<unknown>) => {
    setSubmitting(true)
    try {
      await fn()
      message.success('Updated')
      onAfterMutation()
      await load()
      setApproveOpen(false)
      setRejectOpen(false)
      setRejectPreset(null)
      setRejectCustom('')
    } catch (e) {
      message.error(formatApiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const canAct =
    detail &&
    (detail.requestStatus === 'PENDING' || detail.requestStatus === 'UNDER_REVIEW')

  const applicantName = detail
    ? `${detail.user.firstName ?? ''} ${detail.user.lastName ?? ''}`.trim() || '—'
    : ''

  return (
    <>
      <Drawer
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>Verification request</span>
            {detail ? (
              <Tag color={statusColor(detail.requestStatus)}>{detail.requestStatus}</Tag>
            ) : null}
          </Space>
        }
        placement="right"
        width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth - 24 : 720)}
        onClose={onClose}
        open={open}
        destroyOnClose
        styles={{ body: { paddingBottom: 24 } }}
        extra={
          detail && canAct ? (
            <Space wrap>
              {detail.requestStatus === 'PENDING' ? (
                <Button
                  icon={<EyeOutlined />}
                  loading={submitting}
                  onClick={() =>
                    void runMutation(() =>
                      api.markVerificationUnderReview(detail.id).then(() => undefined),
                    )
                  }
                >
                  Mark under review
                </Button>
              ) : null}
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setApproveOpen(true)}
              >
                Approve
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  setRejectPreset(null)
                  setRejectCustom('')
                  setRejectOpen(true)
                }}
              >
                Reject
              </Button>
            </Space>
          ) : null
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : !detail ? (
          <Empty description="Could not load request" />
        ) : (
          <div>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
              Review documents, then approve or reject. The applicant is notified by email.
            </Typography.Paragraph>

            <Descriptions bordered size="small" column={1} labelStyle={{ width: 160 }}>
              <Descriptions.Item label="Applicant">
                <Space>
                  <UserOutlined />
                  <Typography.Text strong>{applicantName}</Typography.Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <MailOutlined /> {detail.user.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {detail.user.phoneNumber ? (
                  <>
                    <PhoneOutlined /> {detail.user.phoneNumber}
                  </>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Account status">
                <Tag>{detail.user.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Owner type">
                <Tag color={detail.ownerType === 'COMPANY' ? 'purple' : 'blue'}>
                  {detail.ownerType === 'COMPANY' ? (
                    <>
                      <BankOutlined /> Company
                    </>
                  ) : (
                    'Provider'
                  )}
                </Tag>
              </Descriptions.Item>
              {detail.ownerType === 'COMPANY' && detail.user.companyAdmin?.company ? (
                <Descriptions.Item label="Company">
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>
                      {detail.user.companyAdmin.company.companyName}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {detail.user.companyAdmin.company.city}
                      {detail.user.companyAdmin.company.taxId
                        ? ` · Tax ID: ${detail.user.companyAdmin.company.taxId}`
                        : ''}
                    </Typography.Text>
                  </Space>
                </Descriptions.Item>
              ) : null}
              {detail.ownerType === 'PROVIDER' && detail.user.provider ? (
                <Descriptions.Item label="Provider profile">
                  {detail.user.provider.city}
                  {detail.user.provider.address ? ` · ${detail.user.provider.address}` : ''}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="Service">
                {detail.service ? (
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>{detail.service.name}</Typography.Text>
                    <Typography.Text type="secondary">
                      Category: {detail.service.category.name}
                    </Typography.Text>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">—</Typography.Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {new Date(detail.createdAt).toLocaleString()}
              </Descriptions.Item>
              {detail.ownerComment ? (
                <Descriptions.Item label="Applicant note">
                  <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {detail.ownerComment}
                  </Typography.Paragraph>
                </Descriptions.Item>
              ) : null}
              {detail.requestStatus === 'REJECTED' && detail.adminComment ? (
                <Descriptions.Item label="Rejection reason">
                  <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {detail.adminComment}
                  </Typography.Paragraph>
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Divider>
              <FileTextOutlined /> Documents ({detail.documents.length})
            </Divider>
            <List
              dataSource={detail.documents}
              locale={{ emptyText: 'No documents attached' }}
              renderItem={(doc) => (
                <List.Item
                  actions={[
                    <Button
                      key="open"
                      type="link"
                      href={doc.fichierUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open file
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={docTypeLabel(doc.type)}
                    description={
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                        {doc.validatedAt
                          ? ` · Validated ${new Date(doc.validatedAt).toLocaleString()}`
                          : ''}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>

      <Modal
        title="Approve verification"
        open={approveOpen}
        okText="Approve"
        onOk={() => {
          if (!detail) return
          void runMutation(() => api.approveVerificationRequest(detail.id))
        }}
        confirmLoading={submitting}
        onCancel={() => setApproveOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          This approves every file in this submission. The applicant is notified by email.
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="Reject verification"
        open={rejectOpen}
        okText="Reject"
        okButtonProps={{ danger: true }}
        width={560}
        onOk={() => {
          if (!detail) return
          const reason = (rejectCustom.trim() || rejectPreset || '').trim()
          if (!reason) {
            message.warning('Select a reason or enter a custom rejection reason')
            return
          }
          void runMutation(() => api.rejectVerificationRequest(detail.id, { reason }))
        }}
        confirmLoading={submitting}
        onCancel={() => setRejectOpen(false)}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          This reason is stored and shown to the applicant. Pick a preset or write your own.
        </Typography.Paragraph>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Common reasons
        </Typography.Text>
        <Space wrap size="small" style={{ marginBottom: 16, width: '100%' }}>
          {REJECT_PRESET_LABELS.map((label) => (
            <Button
              key={label}
              size="small"
              type={rejectPreset === label ? 'primary' : 'default'}
              onClick={() => {
                setRejectPreset(label)
                setRejectCustom('')
              }}
            >
              {label}
            </Button>
          ))}
        </Space>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Custom reason
        </Typography.Text>
        <Input.TextArea
          rows={4}
          placeholder="Explain what is missing or incorrect…"
          value={rejectCustom}
          onChange={(e) => {
            const v = e.target.value
            setRejectCustom(v)
            if (v.trim()) setRejectPreset(null)
          }}
          maxLength={4000}
          showCount
        />
      </Modal>
    </>
  )
}
