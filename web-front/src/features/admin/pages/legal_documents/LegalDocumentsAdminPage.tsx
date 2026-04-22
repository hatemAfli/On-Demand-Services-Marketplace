import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tabs,
  Tooltip,
  Typography,
  Switch,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../../services/api'
import type {
  LegalDocumentAdminItem,
  LegalDocumentStatus,
  LegalDocumentType,
  Locale,
} from '../../../../types/legal-document'
import './LegalDocumentsAdminPage.css'

type BundleFormValues = {
  titleEn: string
  contentEn: string
  summaryEn?: string
  titleAr: string
  contentAr: string
  summaryAr?: string
  publish: boolean
}

const DOC_TYPES: LegalDocumentType[] = ['TERMS', 'PRIVACY']

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function latestDraft(versions: LegalDocumentAdminItem['versions']) {
  return [...versions].filter((v) => v.status === 'DRAFT').sort((a, b) => b.version - a.version)[0]
}

function latestPublished(versions: LegalDocumentAdminItem['versions']) {
  return [...versions]
    .filter((v) => v.status === 'PUBLISHED')
    .sort((a, b) => b.version - a.version)[0]
}

function getTranslation(version: LegalDocumentAdminItem['versions'][number] | undefined, locale: Locale) {
  const t = version?.translations?.find((x) => x.locale === locale)
  return t
}

function statusColor(status: LegalDocumentStatus) {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'DRAFT') return 'warning'
  return 'default'
}

function labelByType(type: LegalDocumentType) {
  return type === 'TERMS' ? 'Terms of Service' : 'Privacy Policy'
}

type VersionHistoryRow = {
  key: string
  type: LegalDocumentType
  documentId: string
  version: number
  status: LegalDocumentStatus
  titleEn: string
  titleAr: string
  contentEn: string
  contentAr: string
  summaryEn: string | null
  summaryAr: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  isUsed: boolean
}

export function LegalDocumentsAdminPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<LegalDocumentAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<LegalDocumentType | null>(null)
  const [activeType, setActiveType] = useState<LegalDocumentType>('TERMS')
  const [viewRow, setViewRow] = useState<VersionHistoryRow | null>(null)

  const [form] = Form.useForm<BundleFormValues>()
  const baselineRef = useRef<{ doc?: LegalDocumentAdminItem; draft?: LegalDocumentAdminItem['versions'][number]; published?: LegalDocumentAdminItem['versions'][number] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminLegalDocuments()
      setRows(res.data)
    } catch (e) {
      message.error(formatApiMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const tableRows = useMemo(() => {
    return DOC_TYPES.map((type) => ({
      type,
      doc: rows.find((d) => d.type === type),
    }))
  }, [rows])

  const columns: ColumnsType<(typeof tableRows)[number]> = [
    {
      title: 'Document',
      key: 'type',
      render: (_, r) => {
        const doc = r.doc
        if (!doc) return <Tag color="default">Not created</Tag>
        return (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{labelByType(r.type)}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Created: {new Date(doc.createdAt).toLocaleString()}
              {' | '}
              Updated: {new Date(doc.updatedAt).toLocaleString()}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Draft',
      key: 'draft',
      width: 220,
      render: (_, r) => {
        const draft = latestDraft(r.doc?.versions ?? [])
        if (!draft) return <Tag color="default">No draft</Tag>
        return (
          <Space direction="vertical" size={2}>
            <Space size={0} direction="vertical">
              <Typography.Text strong>v{draft.version}</Typography.Text>
              <Tag color={statusColor(draft.status)}>{draft.status}</Tag>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Created: {new Date(draft.createdAt).toLocaleString()}
              {' | '}
              Updated: {new Date(draft.updatedAt).toLocaleString()}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Published',
      key: 'published',
      width: 220,
      render: (_, r) => {
        const published = latestPublished(r.doc?.versions ?? [])
        if (!published) return <Tag color="default">Not published</Tag>
        const usedNow =
          !!r.doc && published.version === r.doc.currentVersion && published.status === 'PUBLISHED'
        return (
          <Space direction="vertical" size={2}>
            <Space direction="vertical" size={2}>
              <Typography.Text strong>v{published.version}</Typography.Text>
              <Space wrap>
                <Tag color={statusColor(published.status)}>{published.status}</Tag>
                {usedNow ? <Tag color="gold">Used</Tag> : null}
              </Space>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Created: {new Date(published.createdAt).toLocaleString()}
              {' | '}
              Updated: {new Date(published.updatedAt).toLocaleString()}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, r) => (
        <Space wrap>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingType(r.type)
                setModalOpen(true)
              }}
              shape="circle"
              className="legal-icon-btn legal-icon-btn-ghost"
              aria-label="Edit legal document"
            />
          </Tooltip>
          <Popconfirm
            title="Delete this legal document?"
            description="Removes all versions in English and Arabic."
            okButtonProps={{ danger: true }}
            disabled={!r.doc}
            onConfirm={async () => {
              if (!r.doc) return
              try {
                await api.deleteAdminLegalDocument(r.doc.id)
                message.success('Document deleted')
                await load()
              } catch (e) {
                message.error(formatApiMessage(e))
              }
            }}
          >
            <Tooltip title="Delete">
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!r.doc}
                shape="circle"
                className="legal-icon-btn"
                aria-label="Delete legal document"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const versionHistoryColumns: ColumnsType<VersionHistoryRow> = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v: number) => <Typography.Text strong>v{v}</Typography.Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: LegalDocumentStatus, row) => (
        <Space wrap>
          <Tag color={statusColor(status)}>{status}</Tag>
          {row.isUsed ? <Tag color="gold">Used</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'English title',
      dataIndex: 'titleEn',
      key: 'titleEn',
      render: (t: string) => t || '—',
    },
    {
      title: 'Arabic title',
      dataIndex: 'titleAr',
      key: 'titleAr',
      render: (t: string) => (t ? <span dir="rtl">{t}</span> : '—'),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 190,
      render: (iso: string) => new Date(iso).toLocaleString(),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 190,
      render: (iso: string) => new Date(iso).toLocaleString(),
    },
    {
      title: 'Published at',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 190,
      render: (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space wrap>
          <Tooltip title="View details">
            <Button
              icon={<EyeOutlined />}
              shape="circle"
              className="legal-icon-btn legal-icon-btn-ghost"
              aria-label="View version details"
              onClick={() => setViewRow(row)}
            />
          </Tooltip>
          <Tooltip title={row.status === 'ARCHIVED' ? 'Retrieve and publish' : 'Retrieve'}>
            <Button
              icon={<UndoOutlined />}
              shape="circle"
              className="legal-icon-btn"
              aria-label="Retrieve legal version"
              disabled={row.isUsed}
              onClick={async () => {
                try {
                  await api.addAdminLegalDocumentVersion(row.documentId, {
                    titleEn: row.titleEn,
                    contentEn: row.contentEn,
                    summaryEn: row.summaryEn ?? undefined,
                    titleAr: row.titleAr,
                    contentAr: row.contentAr,
                    summaryAr: row.summaryAr ?? undefined,
                    publish: true,
                  })
                  message.success(`Version v${row.version} retrieved and published`)
                  await load()
                } catch (e) {
                  message.error(formatApiMessage(e))
                }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const buildHistoryRows = (type: LegalDocumentType): VersionHistoryRow[] => {
    const doc = rows.find((d) => d.type === type)
    if (!doc) return []

    return [...doc.versions]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map((v) => {
        const en = v.translations.find((t) => t.locale === 'EN')
        const ar = v.translations.find((t) => t.locale === 'AR')
        return {
          key: v.id,
          type,
          documentId: doc.id,
          version: v.version,
          status: v.status,
          titleEn: en?.title ?? '',
          titleAr: ar?.title ?? '',
          contentEn: en?.contentMarkdown ?? '',
          contentAr: ar?.contentMarkdown ?? '',
          summaryEn: en?.summary ?? null,
          summaryAr: ar?.summary ?? null,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          publishedAt: v.publishedAt,
          isUsed:
            v.status === 'PUBLISHED' &&
            doc.currentVersion === v.version,
        }
      })
  }

  const openAndPrefill = (type: LegalDocumentType) => {
    const doc = rows.find((d) => d.type === type)
    const draft = doc ? latestDraft(doc.versions) : undefined
    const published = doc ? latestPublished(doc.versions) : undefined
    baselineRef.current = { doc, draft, published }

    const titleEn = getTranslation(draft ?? published, 'EN')?.title ?? ''
    const contentEn = getTranslation(draft ?? published, 'EN')?.contentMarkdown ?? ''
    const summaryEn = getTranslation(draft ?? published, 'EN')?.summary ?? undefined
    const titleAr = getTranslation(draft ?? published, 'AR')?.title ?? ''
    const contentAr = getTranslation(draft ?? published, 'AR')?.contentMarkdown ?? ''
    const summaryAr = getTranslation(draft ?? published, 'AR')?.summary ?? undefined

    form.setFieldsValue({
      titleEn,
      contentEn,
      summaryEn: summaryEn ?? undefined,
      titleAr,
      contentAr,
      summaryAr: summaryAr ?? undefined,
      publish: !!draft ? false : true,
    })
  }

  useEffect(() => {
    if (!modalOpen || !editingType) return
    openAndPrefill(editingType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editingType])

  const saveBundle = async () => {
    const base = baselineRef.current
    if (!editingType || !base) return
    if (!base.doc && !modalOpen) return

    try {
      const v = await form.validateFields()
      setSaving(true)

      const payload = {
        titleEn: v.titleEn.trim(),
        contentEn: v.contentEn.trim(),
        summaryEn: v.summaryEn?.trim() || undefined,
        titleAr: v.titleAr.trim(),
        contentAr: v.contentAr.trim(),
        summaryAr: v.summaryAr?.trim() || undefined,
        publish: v.publish === true,
      }

      if (base.doc) {
        const draft = base.draft
        if (draft) {
          await api.patchAdminLegalDocumentVersion(base.doc.id, draft.id, payload)
        } else {
          await api.addAdminLegalDocumentVersion(base.doc.id, payload)
        }
      } else {
        await api.createAdminLegalDocument({
          type: editingType,
          ...payload,
        })
      }

      message.success('Legal document saved')
      setModalOpen(false)
      await load()
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return
      message.error(formatApiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="legal-page">
      <div className="legal-hero">
        <Typography.Title level={3} className="legal-hero-title">
          Terms & Privacy management
        </Typography.Title>
        <Typography.Paragraph className="legal-hero-subtitle">
          Edit once to create/update/publish both English and Arabic together.
        </Typography.Paragraph>
      </div>

      <Card className="legal-card" variant="borderless">
        <div className="legal-toolbar">
          <Space>
            <Tooltip title={activeType === 'TERMS' ? 'New Terms' : 'New Policy'}>
              <Button
                type="primary"
                size="large"
                shape="circle"
                icon={<PlusOutlined />}
                className="legal-icon-btn"
                aria-label="New legal document"
                onClick={() => {
                  setEditingType(activeType)
                  setModalOpen(true)
                }}
              />
            </Tooltip>
          </Space>
          <Tooltip title="Refresh">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void load()}
              loading={loading}
              shape="circle"
              className="legal-icon-btn legal-icon-btn-ghost"
              aria-label="Refresh legal documents"
            />
          </Tooltip>
        </div>

        <Tabs
          activeKey={activeType}
          onChange={(key) => setActiveType(key as LegalDocumentType)}
          items={[
            {
              key: 'TERMS',
              label: 'Terms',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Table
                    rowKey="type"
                    columns={columns}
                    dataSource={tableRows.filter((r) => r.type === 'TERMS')}
                    loading={loading}
                    pagination={false}
                  />
                  <Card size="small" title="Terms history (including archived)">
                    <Table
                      rowKey="key"
                      columns={versionHistoryColumns}
                      dataSource={buildHistoryRows('TERMS')}
                      loading={loading}
                      pagination={{ pageSize: 6, showSizeChanger: true }}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: 'PRIVACY',
              label: 'Policies',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Table
                    rowKey="type"
                    columns={columns}
                    dataSource={tableRows.filter((r) => r.type === 'PRIVACY')}
                    loading={loading}
                    pagination={false}
                  />
                  <Card size="small" title="Policy history (including archived)">
                    <Table
                      rowKey="key"
                      columns={versionHistoryColumns}
                      dataSource={buildHistoryRows('PRIVACY')}
                      loading={loading}
                      pagination={{ pageSize: 6, showSizeChanger: true }}
                    />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveBundle()}
        okButtonProps={{ loading: saving }}
        width={980}
        title={editingType ? `${editingType} — EN + AR` : 'Legal document'}
        destroyOnClose
        afterClose={() => {
          baselineRef.current = null
          setEditingType(null)
          form.resetFields()
        }}
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            English
          </Typography.Title>
          <Form.Item name="titleEn" label="Title" rules={[{ required: true, message: 'English title is required' }]}>
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="contentEn" label="Content (Markdown)" rules={[{ required: true, message: 'English content is required' }]}>
            <Input.TextArea rows={8} />
          </Form.Item>
          <Form.Item name="summaryEn" label="Summary (optional)">
            <Input.TextArea rows={2} maxLength={2000} showCount />
          </Form.Item>

          <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
            Arabic
          </Typography.Title>
          <Form.Item name="titleAr" label="Title" rules={[{ required: true, message: 'Arabic title is required' }]}>
            <Input maxLength={200} showCount dir="rtl" />
          </Form.Item>
          <Form.Item name="contentAr" label="Content (Markdown)" rules={[{ required: true, message: 'Arabic content is required' }]}>
            <Input.TextArea rows={8} dir="rtl" />
          </Form.Item>
          <Form.Item name="summaryAr" label="Summary (optional)">
            <Input.TextArea rows={2} maxLength={2000} showCount dir="rtl" />
          </Form.Item>

          <Form.Item name="publish" label="Publish after save" valuePropName="checked">
            <Switch checkedChildren="Publish" unCheckedChildren="Save draft" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!viewRow}
        onCancel={() => setViewRow(null)}
        onOk={() => setViewRow(null)}
        title={viewRow ? `${labelByType(viewRow.type)} · v${viewRow.version}` : 'Version details'}
        width={980}
      >
        {viewRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={statusColor(viewRow.status)}>{viewRow.status}</Tag>
              {viewRow.isUsed ? <Tag color="gold">Used</Tag> : null}
              <Typography.Text type="secondary">
                Created: {new Date(viewRow.createdAt).toLocaleString()}
              </Typography.Text>
              <Typography.Text type="secondary">
                Updated: {new Date(viewRow.updatedAt).toLocaleString()}
              </Typography.Text>
              <Typography.Text type="secondary">
                Published: {viewRow.publishedAt ? new Date(viewRow.publishedAt).toLocaleString() : '—'}
              </Typography.Text>
            </Space>

            <Card size="small" title="English">
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {viewRow.titleEn || '—'}
              </Typography.Title>
              {viewRow.summaryEn ? (
                <Typography.Paragraph type="secondary">
                  {viewRow.summaryEn}
                </Typography.Paragraph>
              ) : null}
              <pre className="legal-content-preview">{viewRow.contentEn || '—'}</pre>
            </Card>

            <Card size="small" title="Arabic">
              <Typography.Title level={5} style={{ marginTop: 0 }} dir="rtl">
                {viewRow.titleAr || '—'}
              </Typography.Title>
              {viewRow.summaryAr ? (
                <Typography.Paragraph type="secondary" dir="rtl">
                  {viewRow.summaryAr}
                </Typography.Paragraph>
              ) : null}
              <pre className="legal-content-preview legal-content-preview-rtl">{viewRow.contentAr || '—'}</pre>
            </Card>
          </Space>
        ) : null}
      </Modal>
    </div>
  )
}
