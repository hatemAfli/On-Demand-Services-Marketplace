import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../../services/api'
import type { FaqAdminItem, FaqAudience } from '../../../../types/support'
import './FaqAdminPage.css'

const { TextArea } = Input
const AUDIENCES: FaqAudience[] = ['ALL', 'CLIENT', 'PROVIDER']

type FormValues = {
  audience: FaqAudience
  sortOrder: number
  isPublished: boolean
  questionEn: string
  answerEn: string
  questionAr: string
  answerAr: string
}

function tr(item: FaqAdminItem, locale: 'EN' | 'AR') {
  return item.translations.find((t) => t.locale === locale)
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function audienceLabel(a: FaqAudience) {
  if (a === 'ALL') return 'Everyone'
  if (a === 'CLIENT') return 'Clients'
  return 'Providers'
}

export function FaqAdminPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<FaqAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FaqAdminItem | null>(null)
  const [form] = Form.useForm<FormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminFaq()
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

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      audience: 'ALL',
      sortOrder: rows.length,
      isPublished: true,
      questionEn: '',
      answerEn: '',
      questionAr: '',
      answerAr: '',
    })
    setModalOpen(true)
  }

  const openEdit = (row: FaqAdminItem) => {
    setEditing(row)
    form.setFieldsValue({
      audience: row.audience,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
      questionEn: tr(row, 'EN')?.question ?? '',
      answerEn: tr(row, 'EN')?.answer ?? '',
      questionAr: tr(row, 'AR')?.question ?? '',
      answerAr: tr(row, 'AR')?.answer ?? '',
    })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const payload = {
        audience: values.audience,
        sortOrder: values.sortOrder,
        isPublished: values.isPublished,
        en: { question: values.questionEn, answer: values.answerEn },
        ar: { question: values.questionAr, answer: values.answerAr },
      }
      if (editing) {
        await api.updateAdminFaq(editing.id, payload)
        message.success('FAQ updated')
      } else {
        await api.createAdminFaq(payload)
        message.success('FAQ created')
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      message.error(formatApiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    try {
      await api.deleteAdminFaq(id)
      message.success('FAQ deleted')
      await load()
    } catch (e) {
      message.error(formatApiMessage(e))
    }
  }

  const columns: ColumnsType<FaqAdminItem> = [
    {
      title: 'Order',
      dataIndex: 'sortOrder',
      width: 80,
    },
    {
      title: 'Audience',
      dataIndex: 'audience',
      width: 120,
      render: (v: FaqAudience) => <Tag>{audienceLabel(v)}</Tag>,
    },
    {
      title: 'Question (EN)',
      render: (_, row) => tr(row, 'EN')?.question ?? '—',
    },
    {
      title: 'Published',
      dataIndex: 'isPublished',
      width: 110,
      render: (v: boolean) =>
        v ? <Tag color="success">Yes</Tag> : <Tag color="default">No</Tag>,
    },
    {
      title: 'Actions',
      width: 120,
      render: (_, row) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this FAQ?" onConfirm={() => void onDelete(row.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="faq-admin-page">
      <div className="faq-admin-header">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            FAQ
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Manage frequently asked questions shown to clients and providers in the mobile app.
          </Typography.Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add question
          </Button>
        </Space>
      </div>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />

      <Modal
        title={editing ? 'Edit FAQ' : 'New FAQ'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void onSubmit()}
        confirmLoading={saving}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="faq-admin-form">
          <Space size="large" style={{ display: 'flex' }}>
            <Form.Item name="audience" label="Audience" rules={[{ required: true }]}>
              <Select
                options={AUDIENCES.map((a) => ({
                  value: a,
                  label: audienceLabel(a),
                }))}
              />
            </Form.Item>
            <Form.Item name="sortOrder" label="Sort order" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="isPublished" label="Published" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Typography.Title level={5}>English</Typography.Title>
          <Form.Item name="questionEn" label="Question" rules={[{ required: true, min: 2 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="answerEn" label="Answer" rules={[{ required: true, min: 2 }]}>
            <TextArea rows={4} />
          </Form.Item>

          <Typography.Title level={5}>Arabic</Typography.Title>
          <Form.Item name="questionAr" label="Question" rules={[{ required: true, min: 2 }]}>
            <Input dir="rtl" />
          </Form.Item>
          <Form.Item name="answerAr" label="Answer" rules={[{ required: true, min: 2 }]}>
            <TextArea rows={4} dir="rtl" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
