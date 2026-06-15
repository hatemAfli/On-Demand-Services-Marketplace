import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Segmented,
  Spin,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../../../../services/api";
import type { AdminOutletContext } from "../../layout/adminOutletContext";
import type {
  AdminVerificationRequestItem,
  VerificationOwnerType,
  VerificationReviewStatus,
} from "../../../../types/verification-admin";
import { VerificationRequestDrawer } from "./VerificationRequestDrawer";
import "../users/UsersAdminPage.css";
import "./ValidationsQueuePage.css";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;

const QUEUE_STATUSES: VerificationReviewStatus[] = ["PENDING", "UNDER_REVIEW"];

type StatusFilter = "all" | VerificationReviewStatus;

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return (err as Error)?.message || "Something went wrong";
}

function verificationStatusClass(s: VerificationReviewStatus): string {
  switch (s) {
    case "PENDING":
      return "ua-status-pending";
    case "UNDER_REVIEW":
      return "ua-status-review";
    case "APPROVED":
      return "ua-status-active";
    case "REJECTED":
      return "ua-status-rejected";
    default:
      return "ua-status-deleted";
  }
}

function formatStatusLabel(s: VerificationReviewStatus): string {
  if (s === "UNDER_REVIEW") return "Under review";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function applicantInitials(row: AdminVerificationRequestItem): string {
  const a = (row.user.firstName || "").trim().charAt(0);
  const b = (row.user.lastName || "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

function applicantPhoto(row: AdminVerificationRequestItem): string | null {
  const providerPhoto = row.user.provider?.photoUrl?.trim();
  if (providerPhoto) return providerPhoto;
  const companyLogo = row.user.companyAdmin?.company?.logo?.trim();
  if (companyLogo) return companyLogo;
  return null;
}

function defaultSubtitle(ownerType: VerificationOwnerType): string {
  if (ownerType === "COMPANY") {
    return "Company verification requests from business representatives. Review legal identity and documents before approval.";
  }
  return "Provider verification requests. Review identity documents and service credentials before approval.";
}

export type ValidationsQueuePageProps = {
  ownerType: VerificationOwnerType;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
};

export function ValidationsQueuePage({
  ownerType,
  heroKicker,
  heroTitle,
  heroSubtitle,
}: ValidationsQueuePageProps) {
  const { message } = App.useApp();
  const { refresh: refreshQueueCounts } =
    useOutletContext<AdminOutletContext>();

  const [loading, setLoading] = useState(true);
  const [rawItems, setRawItems] = useState<AdminVerificationRequestItem[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminVerificationRequests({
        ownerType,
        take: 200,
        skip: 0,
      });
      const items = (res.data.items ?? []).filter((r) =>
        QUEUE_STATUSES.includes(r.requestStatus),
      );
      setRawItems(items);
    } catch (e) {
      message.error(formatApiMessage(e));
      setRawItems([]);
    } finally {
      setLoading(false);
    }
  }, [ownerType, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => rawItems.filter((r) => r.requestStatus === "PENDING").length,
    [rawItems],
  );

  const underReviewCount = useMemo(
    () => rawItems.filter((r) => r.requestStatus === "UNDER_REVIEW").length,
    [rawItems],
  );

  const filtered = useMemo(() => {
    let rows = rawItems;
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.requestStatus === statusFilter);
    }
    const q = searchQuery.toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = `${row.user.firstName} ${row.user.lastName}`.toLowerCase();
      const email = row.user.email.toLowerCase();
      const company =
        row.user.companyAdmin?.company?.companyName?.toLowerCase() ?? "";
      const service = row.service?.name?.toLowerCase() ?? "";
      return (
        name.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        service.includes(q)
      );
    });
  }, [rawItems, searchQuery, statusFilter]);

  const onAfterMutation = useCallback(() => {
    void load();
    void refreshQueueCounts();
  }, [load, refreshQueueCounts]);

  const statusSegmentOptions = useMemo(
    () => [
      { label: `All (${rawItems.length})`, value: "all" as const },
      { label: `Pending (${pendingCount})`, value: "PENDING" as const },
      { label: `In review (${underReviewCount})`, value: "UNDER_REVIEW" as const },
    ],
    [rawItems.length, pendingCount, underReviewCount],
  );

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize: PAGE_SIZE,
    total: filtered.length,
    showSizeChanger: false,
    showTotal: (t) => `${t} request${t === 1 ? "" : "s"}`,
    onChange: (p) => setPage(p),
  };

  const columns: ColumnsType<AdminVerificationRequestItem> = [
    {
      title: "Applicant",
      key: "applicant",
      width: 280,
      render: (_, row) => {
        const name =
          `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() ||
          "—";
        const photo = applicantPhoto(row);
        return (
          <div className="users-admin-name-cell">
            <Avatar
              className="users-admin-avatar"
              size={36}
              src={photo ?? undefined}
            >
              {!photo ? applicantInitials(row) : null}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ display: "block", fontSize: 13 }}>
                {name}
              </Typography.Text>
              <Tooltip title={row.user.email}>
                <span className="vq-applicant-email">{row.user.email}</span>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      title: "Context",
      key: "ctx",
      width: 240,
      ellipsis: true,
      render: (_, row) => {
        if (row.ownerType === "COMPANY" && row.user.companyAdmin?.company) {
          return (
            <div>
              <span className="ua-role-tag ua-role-company">Company</span>
              <span className="vq-context-name">
                {row.user.companyAdmin.company.companyName}
              </span>
            </div>
          );
        }
        return (
          <div>
            <span className="ua-role-tag ua-role-provider">Provider</span>
            {row.service ? (
              <Tooltip title={row.service.name}>
                <span className="vq-context-name">{row.service.name}</span>
              </Tooltip>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "requestStatus",
      width: 120,
      render: (s: VerificationReviewStatus) => (
        <span className={`ua-status-tag ${verificationStatusClass(s)}`}>
          {formatStatusLabel(s)}
        </span>
      ),
    },
    {
      title: "Docs",
      key: "docs",
      width: 72,
      align: "center",
      render: (_, row) => (
        <span className="vq-docs-pill">{row.documents.length}</span>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "createdAt",
      width: 120,
      render: (iso: string) => {
        try {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(iso).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </Typography.Text>
          );
        } catch {
          return iso;
        }
      },
    },
  ];

  const subtitle = heroSubtitle || defaultSubtitle(ownerType);

  return (
    <div className="users-admin">
      <div className="users-admin-hero">
        <div className="users-admin-hero-blob" aria-hidden />
        <div className="users-admin-hero-inner">
          <span className="users-admin-kicker">
            <SafetyCertificateOutlined /> {heroKicker}
          </span>
          <Typography.Title level={2} className="users-admin-title">
            {heroTitle}
          </Typography.Title>
          <p className="users-admin-subtitle">{subtitle}</p>
          <div className="users-admin-stats">
            <span className="users-admin-stat-pill">
              <strong>{rawItems.length}</strong> in queue
            </span>
            <span className="users-admin-stat-pill">
              <strong>{pendingCount}</strong> pending
            </span>
            <span className="users-admin-stat-pill">
              <strong>{underReviewCount}</strong> under review
            </span>
          </div>
        </div>
      </div>

      <Card className="users-admin-card" variant="borderless">
        <div className="users-admin-toolbar">
          <div className="users-admin-toolbar-left">
            <Segmented<StatusFilter>
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={statusSegmentOptions}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void load()}
              size="middle"
            >
              Refresh
            </Button>
          </div>
          <Input
            className="users-admin-search"
            allowClear
            prefix={<SearchOutlined style={{ color: "#AFA9EC" }} />}
            placeholder="Search name, email, company, or service…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <Spin spinning={loading}>
          <Table<AdminVerificationRequestItem>
            className="users-admin-table"
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={pagination}
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
                setDrawerId(record.id);
                setDrawerOpen(true);
              },
              style: { cursor: "pointer" },
            })}
            scroll={{ x: 900 }}
          />
        </Spin>
      </Card>

      <VerificationRequestDrawer
        open={drawerOpen}
        requestId={drawerId}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerId(null);
        }}
        onAfterMutation={onAfterMutation}
      />
    </div>
  );
}
