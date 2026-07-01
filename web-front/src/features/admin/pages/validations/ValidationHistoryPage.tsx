import {
  BankOutlined,
  ReloadOutlined,
  SearchOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../services/api";
import type {
  AdminVerificationRequestItem,
  VerificationReviewStatus,
} from "../../../../types/verification-admin";
import { VerificationRequestDrawer } from "./VerificationRequestDrawer";
import "../users/UsersAdminPage.css";

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return (err as Error)?.message || "Something went wrong";
}

function outcomeColor(s: VerificationReviewStatus): string {
  return s === "APPROVED" ? "success" : "error";
}

export function ValidationHistoryPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [rawItems, setRawItems] = useState<AdminVerificationRequestItem[]>([]);
  const [search, setSearch] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [approved, rejected] = await Promise.all([
        api.listAdminVerificationRequests({
          status: "APPROVED",
          take: 200,
          skip: 0,
        }),
        api.listAdminVerificationRequests({
          status: "REJECTED",
          take: 200,
          skip: 0,
        }),
      ]);
      const merged = [
        ...(approved.data.items ?? []),
        ...(rejected.data.items ?? []),
      ].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setRawItems(merged);
    } catch (e) {
      message.error(formatApiMessage(e));
      setRawItems([]);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawItems;
    return rawItems.filter((row) => {
      const name = `${row.user.firstName} ${row.user.lastName}`.toLowerCase();
      const email = row.user.email.toLowerCase();
      const company =
        row.user.companyAdmin?.company?.companyName?.toLowerCase() ?? "";
      const service = row.service?.name?.toLowerCase() ?? "";
      const ot = row.ownerType.toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        company.includes(q) ||
        service.includes(q) ||
        ot.includes(q)
      );
    });
  }, [rawItems, search]);

  const columns: ColumnsType<AdminVerificationRequestItem> = [
    {
      title: "Outcome",
      dataIndex: "requestStatus",
      width: 120,
      render: (s: VerificationReviewStatus) => (
        <Tag color={outcomeColor(s)} style={{ fontWeight: 700 }}>
          {s}
        </Tag>
      ),
    },
    {
      title: "Applicant",
      key: "applicant",
      render: (_, row) => {
        const name =
          `${row.user.firstName ?? ""} ${row.user.lastName ?? ""}`.trim() ||
          "—";
        return (
          <div>
            <Typography.Text strong>{name}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {row.user.email}
              </Typography.Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "Type",
      key: "ownerType",
      width: 120,
      render: (_, row) =>
        row.ownerType === "COMPANY" ? (
          <Tag color="purple" icon={<BankOutlined />}>
            Company
          </Tag>
        ) : (
          <Tag color="blue" icon={<SolutionOutlined />}>
            Provider
          </Tag>
        ),
    },
    {
      title: "Subject",
      key: "subject",
      ellipsis: true,
      render: (_, row) => {
        if (row.ownerType === "COMPANY" && row.user.companyAdmin?.company) {
          return row.user.companyAdmin.company.companyName;
        }
        return row.service?.name ?? "—";
      },
    },
    {
      title: "Last update",
      dataIndex: "updatedAt",
      width: 140,
      render: (iso: string) =>
        new Date(iso).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
  ];

  return (
    <div className="users-admin">
      <Card className="users-admin-card" variant="borderless">
        <div className="users-admin-toolbar">
          <div className="users-admin-toolbar-left">
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <Input
            className="users-admin-search"
            allowClear
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Search name, email, company, service, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Spin spinning={loading}>
          <Table<AdminVerificationRequestItem>
            className="users-admin-table"
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            locale={{
              emptyText: loading ? (
                <span />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No completed verifications yet"
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
            scroll={{ x: 880 }}
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
        onAfterMutation={() => void load()}
      />
    </div>
  );
}
