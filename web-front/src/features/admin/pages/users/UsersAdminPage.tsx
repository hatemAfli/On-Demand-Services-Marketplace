import {
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Card,
  Input,
  Segmented,
  Spin,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../../../services/api";
import type { AdminUserListItem } from "../../../../types/admin-user";
import type { AccountStatus, UserRole } from "../../../../types/user";
import "./UsersAdminPage.css";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

type SegmentValue = "all" | UserRole;

const PATH_BY_SEGMENT: Record<SegmentValue, string> = {
  all: "/admin/users/all",
  CLIENT: "/admin/users/clients",
  PROVIDER: "/admin/users/providers",
  COMPANY_ADMIN: "/admin/users/company-admins",
  PLATFORM_ADMIN: "/admin/users/platform-admins",
};

const SEGMENT_BY_PATH: Record<string, SegmentValue> = {
  "/admin/users/all": "all",
  "/admin/users/clients": "CLIENT",
  "/admin/users/providers": "PROVIDER",
  "/admin/users/company-admins": "COMPANY_ADMIN",
  "/admin/users/platform-admins": "PLATFORM_ADMIN",
};

function segmentFromPathname(pathname: string): SegmentValue {
  const key = pathname.replace(/\/$/, "");
  return SEGMENT_BY_PATH[key] ?? "all";
}

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return (err as Error)?.message || "Something went wrong";
}

function roleInfo(role: UserRole): { className: string; label: string } {
  switch (role) {
    case "CLIENT":
      return { className: "ua-role-client", label: "Client" };
    case "PROVIDER":
      return { className: "ua-role-provider", label: "Provider" };
    case "COMPANY_ADMIN":
      return { className: "ua-role-company", label: "Company admin" };
    case "PLATFORM_ADMIN":
      return { className: "ua-role-admin", label: "Platform admin" };
    default:
      return { className: "", label: role };
  }
}

function statusInfo(status: AccountStatus): string {
  switch (status) {
    case "ACTIVE":
      return "ua-status-active";
    case "PENDING":
      return "ua-status-pending";
    case "REJECTED":
      return "ua-status-rejected";
    case "SUSPENDED":
      return "ua-status-suspended";
    case "DELETED":
      return "ua-status-deleted";
    default:
      return "ua-status-deleted";
  }
}

function userInitials(u: AdminUserListItem): string {
  const a = (u.firstName || "").trim().charAt(0);
  const b = (u.lastName || "").trim().charAt(0);
  const s = `${a}${b}`.toUpperCase();
  return s || "?";
}

export function UsersAdminPage() {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const segment = useMemo(
    () => segmentFromPathname(location.pathname),
    [location.pathname],
  );

  const apiRole: UserRole | undefined = segment === "all" ? undefined : segment;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setSearchInput("");
    setSearchQuery("");
  }, [segment]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminUsers({
        role: apiRole,
        search: searchQuery || undefined,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      const { items: rows, total: count } = res.data;
      setItems(rows ?? []);
      setTotal(count ?? 0);
    } catch (e) {
      message.error(formatApiMessage(e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [apiRole, page, searchQuery, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize: PAGE_SIZE,
    total,
    showSizeChanger: false,
    showTotal: (t) => `${t} users`,
    onChange: (p) => setPage(p),
  };

  const segmentOptions = useMemo(
    () => [
      { label: "All", value: "all" as const },
      { label: "Clients", value: "CLIENT" as const },
      { label: "Providers", value: "PROVIDER" as const },
      { label: "Company admins", value: "COMPANY_ADMIN" as const },
      { label: "Platform admins", value: "PLATFORM_ADMIN" as const },
    ],
    [],
  );

  const onSegmentChange = (val: SegmentValue) => {
    navigate(PATH_BY_SEGMENT[val]);
  };

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: "User",
      key: "user",
      width: 260,
      render: (_, u) => {
        const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "—";
        const role = roleInfo(u.role);
        return (
          <div className="users-admin-name-cell">
            <Avatar className="users-admin-avatar" size={36}>
              {userInitials(u)}
            </Avatar>
            <div>
              <Typography.Text
                strong
                style={{ display: "block", fontSize: 13 }}
              >
                {name}
              </Typography.Text>
              <span className={`ua-role-tag ${role.className}`}>
                {role.label}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      ellipsis: true,
      render: (email: string) => (
        <Tooltip title={email}>
          <Typography.Text
            copyable={{ text: email }}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12 }}
          >
            {email}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phoneNumber",
      key: "phone",
      width: 150,
      render: (p: string | null) =>
        p ? (
          <Typography.Text
            copyable={{ text: p }}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12 }}
          >
            {p}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Typography.Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s: AccountStatus) => (
        <span className={`ua-status-tag ${statusInfo(s)}`}>
          {s.charAt(0) + s.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      title: "Verified",
      key: "verified",
      width: 150,
      render: (_, u) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            className={u.isEmailVerified ? "ua-verify-yes" : "ua-verify-no"}
          >
            {u.isEmailVerified ? "✓ Email" : "Email"}
          </span>
          <span
            className={u.isPhoneVerified ? "ua-verify-yes" : "ua-verify-no"}
          >
            {u.isPhoneVerified ? "✓ Phone" : "Phone"}
          </span>
        </div>
      ),
    },
    {
      title: "Joined",
      dataIndex: "createdAt",
      key: "createdAt",
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

  return (
    <div className="users-admin">
      {/* Hero */}

      {/* Table card */}
      <Card className="users-admin-card" variant="borderless">
        <div className="users-admin-toolbar">
          <div className="users-admin-toolbar-left">
            <Segmented<SegmentValue>
              value={segment}
              onChange={onSegmentChange}
              options={segmentOptions}
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
              style: { cursor: "pointer" },
            })}
          />
        </Spin>
      </Card>
    </div>
  );
}
