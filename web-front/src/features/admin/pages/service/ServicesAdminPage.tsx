import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
  Upload,
} from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../../services/api'
import { uploadServiceCatalogPhoto } from '../../../../services/servicePhotoUpload'
import type { ServiceCategory } from '../../../../types/service-category'
import type { AdminService } from '../../../../types/service'
import './ServicesAdminPage.css'

type ServiceFormValues = {
  nameEn: string
  nameAr?: string
  descriptionEn?: string
  descriptionAr?: string
  categoryId: string
  active: boolean
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

export function ServicesAdminPage() {
  const { message, notification } = App.useApp()
  const [form] = Form.useForm<ServiceFormValues>()
  const [loading, setLoading] = useState(true)
  const [mutatingIds, setMutatingIds] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [activeOnly, setActiveOnly] = useState(false)
  const [rows, setRows] = useState<AdminService[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<AdminService | null>(null)
  const [servicePhotoUrl, setServicePhotoUrl] = useState<string | null>(null)
  const [photoFileList, setPhotoFileList] = useState<UploadFile[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const draftPhotoFolderKeyRef = useRef<string>(crypto.randomUUID())
  const pendingActionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  )

  const setRowMutating = (id: string, value: boolean) => {
    setMutatingIds((prev) => {
      if (value) return { ...prev, [id]: true }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const clearPendingAction = (actionKey: string) => {
    const t = pendingActionTimers.current[actionKey]
    if (t) {
      clearTimeout(t)
      delete pendingActionTimers.current[actionKey]
    }
  }

  const categoryOptions = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [categories],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        api.listAdminServices({
          activeOnly: activeOnly || undefined,
          categoryId: categoryFilter || undefined,
        }),
        api.listAdminServiceCategories({ activeOnly: true }),
      ])
      setRows(servicesRes.data)
      setCategories(categoriesRes.data)
    } catch (e) {
      message.error(formatApiMessage(e))
      setRows([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [activeOnly, categoryFilter, message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(
    () => () => {
      Object.keys(pendingActionTimers.current).forEach((k) => {
        clearPendingAction(k)
      })
    },
    [],
  )

  const openCreate = () => {
    setEditingService(null)
    draftPhotoFolderKeyRef.current = crypto.randomUUID()
    setServicePhotoUrl(null)
    setPhotoFileList([])
    setModalOpen(true)
  }
  const openEdit = (row: AdminService) => {
    setEditingService(row)
    setModalOpen(true)
  }
  const closeCreate = () => setModalOpen(false)

  const onCreateModalChange = (open: boolean) => {
    if (open) {
      if (!editingService) {
        draftPhotoFolderKeyRef.current = crypto.randomUUID()
        setServicePhotoUrl(null)
        setPhotoFileList([])
      } else {
        const u = editingService.servicePhoto
        setServicePhotoUrl(u ?? null)
        setPhotoFileList(
          u
            ? [
                {
                  uid: '-svc-photo',
                  name: 'service-photo',
                  status: 'done',
                  url: u,
                },
              ]
            : [],
        )
      }
      form.setFieldsValue({
        nameEn:
          editingService?.translations?.en?.name ??
          editingService?.name ??
          '',
        nameAr: editingService?.translations?.ar?.name ?? '',
        descriptionEn:
          editingService?.translations?.en?.description ??
          editingService?.description ??
          '',
        descriptionAr: editingService?.translations?.ar?.description ?? '',
        categoryId: editingService?.categoryId ?? (undefined as unknown as string),
        active: editingService?.active ?? true,
      })
    } else {
      form.resetFields()
      setEditingService(null)
      setServicePhotoUrl(null)
      setPhotoFileList([])
    }
  }

  const handleBeforeServicePhotoUpload = async (file: RcFile) => {
    if (!file.type.startsWith('image/')) {
      message.error('Please choose an image file (JPEG, PNG, WebP, GIF).')
      return Upload.LIST_IGNORE
    }
    if (file.size / 1024 / 1024 >= 5) {
      message.error('Image must be 5MB or smaller.')
      return Upload.LIST_IGNORE
    }
    setPhotoUploading(true)
    try {
      const folderKey = editingService?.id ?? draftPhotoFolderKeyRef.current
      const url = await uploadServiceCatalogPhoto(file, { folderKey })
      setServicePhotoUrl(url)
      setPhotoFileList([
        { uid: '-svc-photo', name: file.name, status: 'done', url },
      ])
      message.success('Photo uploaded')
    } catch (e) {
      message.error(formatApiMessage(e))
    } finally {
      setPhotoUploading(false)
    }
    return false
  }

  const submitSave = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        translations: {
          en: {
            name: values.nameEn.trim(),
            ...(values.descriptionEn?.trim()
              ? { description: values.descriptionEn.trim() }
              : {}),
          },
          ...(values.nameAr?.trim()
            ? {
                ar: {
                  name: values.nameAr.trim(),
                  ...(values.descriptionAr?.trim()
                    ? { description: values.descriptionAr.trim() }
                    : {}),
                },
              }
            : {}),
        },
        categoryId: values.categoryId,
        active: values.active !== false,
      }
      if (editingService) {
        await api.updateAdminService(editingService.id, {
          ...payload,
          servicePhoto: servicePhotoUrl,
        })
        message.success('Service updated')
      } else {
        await api.createAdminService({
          ...payload,
          ...(servicePhotoUrl ? { servicePhoto: servicePhotoUrl } : {}),
        })
        message.success('Service created')
      }
      closeCreate()
      await load()
    } catch (e) {
      if ((e as { errorFields?: unknown })?.errorFields) return
      message.error(formatApiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (row: AdminService, checked: boolean) => {
    const actionKey = `toggle:${row.id}`
    clearPendingAction(actionKey)
    notification.destroy(actionKey)

    const previousValue = row.active
    setRows((prev) =>
      prev.map((s) => (s.id === row.id ? { ...s, active: checked } : s)),
    )
    setRowMutating(row.id, true)

    const rollback = () => {
      clearPendingAction(actionKey)
      notification.destroy(actionKey)
      setRows((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, active: previousValue } : s)),
      )
      setRowMutating(row.id, false)
    }

    notification.open({
      key: actionKey,
      message: checked ? 'Service activated' : 'Service deactivated',
      description: 'Undo within 5 seconds if this was accidental.',
      duration: 5,
      btn: (
        <Button size="small" onClick={rollback}>
          Undo
        </Button>
      ),
    })

    pendingActionTimers.current[actionKey] = setTimeout(async () => {
      clearPendingAction(actionKey)
      notification.destroy(actionKey)
      try {
        await api.updateAdminService(row.id, { active: checked })
      } catch (e) {
        setRows((prev) =>
          prev.map((s) => (s.id === row.id ? { ...s, active: previousValue } : s)),
        )
        message.error(formatApiMessage(e))
      } finally {
        setRowMutating(row.id, false)
      }
    }, 5000)
  }

  const removeService = async (row: AdminService) => {
    const actionKey = `delete:${row.id}`
    clearPendingAction(actionKey)
    notification.destroy(actionKey)
    const prevRows = rows
    const index = rows.findIndex((s) => s.id === row.id)

    setRows((prev) => prev.filter((s) => s.id !== row.id))
    notification.open({
      key: actionKey,
      message: 'Service removed',
      description: 'Undo within 5 seconds before the deletion is committed.',
      duration: 5,
      btn: (
        <Button
          size="small"
          onClick={() => {
            clearPendingAction(actionKey)
            notification.destroy(actionKey)
            setRows((prev) => {
              const next = [...prev]
              const safeIndex = index >= 0 ? index : prev.length
              next.splice(safeIndex, 0, row)
              return next
            })
          }}
        >
          Undo
        </Button>
      ),
    })

    pendingActionTimers.current[actionKey] = setTimeout(async () => {
      clearPendingAction(actionKey)
      notification.destroy(actionKey)
      try {
        await api.deleteAdminService(row.id)
        message.success('Service deleted')
      } catch (e) {
        setRows(prevRows)
        message.error(formatApiMessage(e))
      }
    }, 5000)
  }

  const columns: ColumnsType<AdminService> = [
    {
      title: 'Photo',
      key: 'servicePhoto',
      width: 72,
      render: (_, row) =>
        row.servicePhoto ? (
          <img
            src={row.servicePhoto}
            alt=""
            className="svc-table-thumb"
            width={44}
            height={44}
          />
        ) : (
          <span className="svc-muted-line">—</span>
        ),
    },
    {
      title: 'Service',
      dataIndex: 'name',
      key: 'name',
      render: (name, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {row.translations?.en?.name || String(name)}
          </Typography.Text>
          {row.translations?.ar?.name ? (
            <Typography.Text className="svc-muted-line" dir="rtl">
              {row.translations.ar.name}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary" className="svc-muted-line">
            {(row.translations?.en?.description || row.description || '').trim() ||
              'No description'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 220,
      render: (category: AdminService['category']) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{category.name}</Typography.Text>
          <Typography.Text type="secondary" className="svc-muted-line">
            /{category.slug}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      width: 160,
      render: (active: boolean) =>
        active ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, row) => (
        <Space wrap>
          <Tooltip title={row.active ? 'Deactivate' : 'Activate'}>
            <Switch
              checked={row.active}
              loading={!!mutatingIds[row.id]}
              checkedChildren="On"
              unCheckedChildren="Off"
              onChange={(checked) => void toggleActive(row, checked)}
            />
          </Tooltip>
          <Tooltip title="Edit service">
            <Button
              icon={<EditOutlined />}
              onClick={() => openEdit(row)}
              disabled={!!mutatingIds[row.id]}
              shape="circle"
              className="svc-icon-btn svc-icon-btn-ghost"
              aria-label="Edit service"
            />
          </Tooltip>
          <Popconfirm
            title="Delete service?"
            description="This fails if verification requests still reference it."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => void removeService(row)}
          >
            <Tooltip title="Delete service">
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={!!mutatingIds[row.id]}
                shape="circle"
                className="svc-icon-btn"
                aria-label="Delete service"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="svc-page">
      <div className="svc-hero">
        <div className="svc-hero-inner">
          <Typography.Title level={3} className="svc-hero-title">
            Services catalog
          </Typography.Title>
          <Typography.Paragraph className="svc-hero-desc">
            Create marketplace services and assign each one to its category.
            These entries are later selected by providers during verification.
          </Typography.Paragraph>
        </div>
      </div>

      <Card className="svc-card" variant="borderless">
        <div className="svc-toolbar">
          <Space wrap>
            <Tooltip title="New service">
              <Button
                type="primary"
                size="large"
                shape="circle"
                icon={<PlusOutlined />}
                onClick={openCreate}
                className="svc-icon-btn"
                aria-label="New service"
              />
            </Tooltip>
            <Select
              allowClear
              showSearch
              placeholder="Filter by category"
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value)}
              options={categoryOptions}
              className="svc-category-filter"
            />
            <Checkbox
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            >
              Active only
            </Checkbox>
          </Space>
          <Tooltip title="Refresh">
            <Button
              onClick={() => void load()}
              loading={loading}
              shape="circle"
              icon={<ReloadOutlined />}
              className="svc-icon-btn svc-icon-btn-ghost"
              aria-label="Refresh services"
            />
          </Tooltip>
        </div>

        <Table<AdminService>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowClassName={(row) =>
            mutatingIds[row.id] ? 'svc-row-mutating svc-row-skeleton' : ''
          }
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        open={modalOpen}
        onCancel={closeCreate}
        afterOpenChange={onCreateModalChange}
        destroyOnClose
        className="svc-modal"
        title={
          <Space>
            <AppstoreOutlined className="svc-modal-icon" />
            <span>{editingService ? 'Edit service' : 'Create service'}</span>
          </Space>
        }
        okText={editingService ? 'Save changes' : 'Create service'}
        okButtonProps={{ loading: submitting }}
        onOk={() => void submitSave()}
      >
        <Typography.Paragraph type="secondary" className="svc-modal-intro">
          Choose the category and update the service details. You can also move
          a service to a different category from here. Optionally add a catalog
          photo stored in the <code>service_photos</code> bucket.
        </Typography.Paragraph>

        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item label="Catalog photo (optional)">
            <Upload
              listType="picture-card"
              maxCount={1}
              fileList={photoFileList}
              beforeUpload={handleBeforeServicePhotoUpload}
              onRemove={() => {
                setServicePhotoUrl(null)
                setPhotoFileList([])
              }}
            >
              {photoFileList.length >= 1 ? null : (
                <div>
                  {photoUploading ? <LoadingOutlined /> : <PlusOutlined />}
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item
            name="categoryId"
            label="Category"
            rules={[{ required: true, message: 'Choose a category' }]}
          >
            <Select
              size="large"
              showSearch
              placeholder="Select category"
              options={categoryOptions}
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item
            name="nameEn"
            label="Service name (English)"
            rules={[
              { required: true, message: 'Enter the English service name' },
              { max: 200, message: 'Max 200 characters' },
            ]}
          >
            <Input
              size="large"
              placeholder="e.g. Deep cleaning"
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="nameAr"
            label="Service name (Arabic, optional)"
            rules={[{ max: 200, message: 'Max 200 characters' }]}
          >
            <Input
              size="large"
              dir="rtl"
              placeholder="مثال: تنظيف عميق"
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="descriptionEn"
            label="Description (English, optional)"
            rules={[{ max: 10000, message: 'Max 10000 characters' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Short description shown to admins/providers..."
              maxLength={10000}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="descriptionAr"
            label="Description (Arabic, optional)"
            rules={[{ max: 10000, message: 'Max 10000 characters' }]}
          >
            <Input.TextArea
              rows={4}
              dir="rtl"
              placeholder="وصف قصير بالعربية..."
              maxLength={10000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="active"
            label="Visibility"
            valuePropName="checked"
            initialValue
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
