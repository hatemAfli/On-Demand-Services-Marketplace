import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { App, Button, DatePicker, Input, Select, Table, Tag } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../../../../services/adminApi'
import type {
  PlatformActivityLogEntry,
  PlatformAuditAction,
} from '../../../../types/admin'
import './ActivityLogsAdminPage.css'

const ACTION_OPTIONS: { value: PlatformAuditAction; label: string }[] = [
  { value: 'USER_STATUS_UPDATED', label: 'User status' },
  { value: 'VERIFICATION_APPROVED', label: 'Verification approved' },
  { value: 'VERIFICATION_REJECTED', label: 'Verification rejected' },
  { value: 'VERIFICATION_UNDER_REVIEW', label: 'Verification under review' },
  { value: 'VERIFICATION_DOCUMENT_REVIEWED', label: 'Document reviewed' },
  { value: 'APPOINTMENT_DISPUTED', label: 'Appointment disputed' },
  { value: 'APPOINTMENT_INTERVENED', label: 'Appointment intervened' },
  { value: 'COMPLAINT_REVIEWED', label: 'Complaint reviewed' },
  { value: 'REVIEW_HIDDEN', label: 'Review hidden' },
  { value: 'REVIEW_RESTORED', label: 'Review restored' },
  { value: 'REVIEW_DELETED', label: 'Review deleted' },
  { value: 'SERVICE_CATEGORY_CREATED', label: 'Category created' },
  { value: 'SERVICE_CATEGORY_UPDATED', label: 'Category updated' },
  { value: 'SERVICE_CATEGORY_DELETED', label: 'Category deleted' },
  { value: 'SERVICE_CREATED', label: 'Service created' },
  { value: 'SERVICE_UPDATED', label: 'Service updated' },
  { value: 'SERVICE_DELETED', label: 'Service deleted' },
  { value: 'LEGAL_DOCUMENT_CREATED', label: 'Legal doc created' },
  { value: 'LEGAL_DOCUMENT_UPDATED', label: 'Legal doc updated' },
  { value: 'LEGAL_DOCUMENT_VERSION_ADDED', label: 'Legal version added' },
  { value: 'LEGAL_DOCUMENT_PUBLISHED', label: 'Legal doc published' },
  { value: 'LEGAL_DOCUMENT_DELETED', label: 'Legal doc deleted' },
  { value: 'FAQ_CREATED', label: 'FAQ created' },
  { value: 'FAQ_UPDATED', label: 'FAQ updated' },
  { value: 'FAQ_DELETED', label: 'FAQ deleted' },
  { value: 'SUPPORT_MESSAGE_STATUS_UPDATED', label: 'Support message' },
  { value: 'DATA_EXPORT', label: 'Data export' },
]

const ACTION_COLORS: Partial<Record<PlatformAuditAction, string>> = {
  USER_STATUS_UPDATED: 'blue',
  VERIFICATION_APPROVED: 'green',
  VERIFICATION_REJECTED: 'red',
  VERIFICATION_UNDER_REVIEW: 'gold',
  VERIFICATION_DOCUMENT_REVIEWED: 'cyan',
  APPOINTMENT_DISPUTED: 'orange',
  APPOINTMENT_INTERVENED: 'volcano',
  COMPLAINT_REVIEWED: 'purple',
  REVIEW_HIDDEN: 'default',
  REVIEW_RESTORED: 'green',
  REVIEW_DELETED: 'red',
  DATA_EXPORT: 'geekblue',
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data
  const msg = data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (typeof msg === 'string') return msg
  return (err as Error)?.message || 'Something went wrong'
}

function actionLabel(action: PlatformAuditAction): string {
  return ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function ActivityLogsAdminPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<PlatformActivityLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [actionFilter, setActionFilter] = useState<PlatformAuditAction | undefined>()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [fromDate, setFromDate] = useState<string | undefined>()
  const [toDate, setToDate] = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [logsRes, statsRes] = await Promise.all([
        adminApi.getActivityLogs({
          take: pageSize,
          skip: (page - 1) * pageSize,
          action: actionFilter,
          search: search.trim() || undefined,
          from: fromDate,
          to: toDate,
        }),
        adminApi.getActivityLogStats(),
      ])
      setRows(logsRes.data.items)
      setTotal(logsRes.data.total)
      setStats(statsRes.data)
    } catch (e) {
      message.error(formatApiMessage(e))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [actionFilter, fromDate, message, page, pageSize, search, toDate])

  useEffect(() => {
    void load()
  }, [load])

  const pagination = useMemo<TablePaginationConfig>(
    () => ({
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50'],
      onChange: (nextPage, nextSize) => {
        setPage(nextPage)
        if (nextSize !== pageSize) setPageSize(nextSize)
      },
    }),
    [page, pageSize, total],
  )

  const columns: ColumnsType<PlatformActivityLogEntry> = [
    {
      title: 'Log',
      dataIndex: 'displayId',
      width: 120,
      render: (v: string) => <span className="activity-logs-page__meta">{v}</span>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 180,
      render: (action: PlatformAuditAction) => (
        <Tag color={ACTION_COLORS[action] ?? 'default'} className="activity-logs-page__action-tag">
          {actionLabel(action)}
        </Tag>
      ),
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      render: (v: string) => <span className="activity-logs-page__summary">{v}</span>,
    },
    {
      title: 'Actor',
      dataIndex: 'actorName',
      width: 140,
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      width: 130,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'When',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => formatDate(v),
    },
  ]

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await adminApi.exportActivityLogsCsv()
      const url = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'platform-activity-logs.csv'
      link.click()
      URL.revokeObjectURL(url)
      message.success('Export started')
      void load()
    } catch (e) {
      message.error(formatApiMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="activity-logs-page">
      <div className="activity-logs-page__stats">
        <div className="activity-logs-page__stat">
          <strong>{stats.today}</strong>
          <span>Actions today</span>
        </div>
        <div className="activity-logs-page__stat">
          <strong>{stats.thisWeek}</strong>
          <span>Last 7 days</span>
        </div>
        <div className="activity-logs-page__stat">
          <strong>{stats.total}</strong>
          <span>All time</span>
        </div>
      </div>

      <div className="activity-logs-page__toolbar">
        <div className="activity-logs-page__field">
          <label htmlFor="activity-action">Action</label>
          <Select
            id="activity-action"
            allowClear
            placeholder="All actions"
            style={{ minWidth: 180 }}
            value={actionFilter}
            options={ACTION_OPTIONS}
            onChange={(v) => {
              setActionFilter(v)
              setPage(1)
            }}
          />
        </div>
        <div className="activity-logs-page__field">
          <label htmlFor="activity-search">Search</label>
          <Input.Search
            id="activity-search"
            allowClear
            placeholder="Search summary…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(v) => {
              setSearch(v)
              setPage(1)
            }}
          />
        </div>
        <div className="activity-logs-page__field">
          <label>From</label>
          <DatePicker
            value={fromDate ? dayjs(fromDate) : null}
            onChange={(d) => {
              setFromDate(d ? d.format('YYYY-MM-DD') : undefined)
              setPage(1)
            }}
          />
        </div>
        <div className="activity-logs-page__field">
          <label>To</label>
          <DatePicker
            value={toDate ? dayjs(toDate) : null}
            onChange={(d) => {
              setToDate(d ? d.format('YYYY-MM-DD') : undefined)
              setPage(1)
            }}
          />
        </div>
        <div className="activity-logs-page__actions">
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="activity-logs-page__table-wrap">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={pagination}
          size="middle"
        />
      </div>
    </div>
  )
}
