import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../services/api";
import type { ServiceCategory } from "../../../../types/service-category";
import { SLUG_PATTERN, slugifyName } from "../../../../utils/slugify";
import { getCategoryFa5Icon } from "./categoryFa5Icons";
import { CategoryIconPickerField } from "./CategoryIconPickerField";
import "./ServiceCategoriesAdminPage.css";

type FormValues = {
  nameEn: string;
  nameAr?: string;
  slug?: string;
  iconKey?: string;
  iconUrl?: string;
  sortOrder?: number | null;
  active: boolean;
};

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return (err as Error)?.message || "Something went wrong";
}

export function ServiceCategoriesAdminPage() {
  const { message, notification } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [rows, setRows] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingIds, setMutatingIds] = useState<Record<string, boolean>>({});
  const [activeOnly, setActiveOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ServiceCategory | null>(null);
  const pendingActionTimers = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  const nameWatch = Form.useWatch("nameEn", form);
  const slugWatch = Form.useWatch("slug", form);

  const slugPreview = useMemo(() => {
    if (slugWatch?.trim()) return slugWatch.trim().toLowerCase();
    if (nameWatch?.trim()) return slugifyName(nameWatch);
    return "—";
  }, [nameWatch, slugWatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminServiceCategories({
        activeOnly: activeOnly || undefined,
      });
      setRows(res.data);
    } catch (e) {
      message.error(formatApiMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeOnly, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => () => {
      Object.keys(pendingActionTimers.current).forEach((k) => {
        const t = pendingActionTimers.current[k];
        clearTimeout(t);
      });
    },
    [],
  );

  const setRowMutating = (id: string, value: boolean) => {
    setMutatingIds((prev) => {
      if (value) return { ...prev, [id]: true };
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearPendingAction = (actionKey: string) => {
    const t = pendingActionTimers.current[actionKey];
    if (t) {
      clearTimeout(t);
      delete pendingActionTimers.current[actionKey];
    }
  };

  const openCreate = () => {
    setEditingCategory(null);
    setModalOpen(true);
  };
  const openEdit = (row: ServiceCategory) => {
    setEditingCategory(row);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const onModalOpenChange = (open: boolean) => {
    if (open) {
      form.setFieldsValue({
        nameEn:
          editingCategory?.translations?.en?.name ??
          editingCategory?.name ??
          "",
        nameAr: editingCategory?.translations?.ar?.name ?? "",
        slug: editingCategory?.slug ?? "",
        iconKey: editingCategory?.iconKey ?? "",
        iconUrl: editingCategory?.iconUrl ?? "",
        sortOrder: editingCategory?.sortOrder ?? 0,
        active: editingCategory?.active ?? true,
      });
    } else {
      form.resetFields();
      setEditingCategory(null);
    }
  };

  const submitSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const slugTrim = values.slug?.trim().toLowerCase();
      const payload = {
        translations: {
          en: { name: values.nameEn.trim() },
          ...(values.nameAr?.trim()
            ? { ar: { name: values.nameAr.trim() } }
            : {}),
        },
        ...(slugTrim ? { slug: slugTrim } : {}),
        ...(values.iconKey?.trim() ? { iconKey: values.iconKey.trim() } : {}),
        ...(values.iconUrl?.trim() ? { iconUrl: values.iconUrl.trim() } : {}),
        ...(typeof values.sortOrder === "number"
          ? { sortOrder: values.sortOrder }
          : {}),
        active: values.active !== false,
      };
      if (editingCategory) {
        await api.updateAdminServiceCategory(editingCategory.id, payload);
        message.success("Category updated");
      } else {
        await api.createAdminServiceCategory(payload);
        message.success("Category created");
      }
      closeModal();
      await load();
    } catch (e) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error(formatApiMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: ServiceCategory, checked: boolean) => {
    const actionKey = `toggle:${row.id}`;
    clearPendingAction(actionKey);
    notification.destroy(actionKey);
    const previousValue = row.active;
    setRows((prev) =>
      prev.map((c) => (c.id === row.id ? { ...c, active: checked } : c)),
    );
    setRowMutating(row.id, true);

    const rollback = () => {
      clearPendingAction(actionKey);
      notification.destroy(actionKey);
      setRows((prev) =>
        prev.map((c) =>
          c.id === row.id ? { ...c, active: previousValue } : c,
        ),
      );
      setRowMutating(row.id, false);
    };

    notification.open({
      key: actionKey,
      message: checked ? "Category activated" : "Category deactivated",
      description: "Undo within 5 seconds if this was accidental.",
      duration: 5,
      btn: (
        <Button size="small" onClick={rollback}>
          Undo
        </Button>
      ),
    });

    pendingActionTimers.current[actionKey] = setTimeout(async () => {
      clearPendingAction(actionKey);
      notification.destroy(actionKey);
      try {
        await api.updateAdminServiceCategory(row.id, { active: checked });
      } catch (e) {
        setRows((prev) =>
          prev.map((c) =>
            c.id === row.id ? { ...c, active: previousValue } : c,
          ),
        );
        message.error(formatApiMessage(e));
      } finally {
        setRowMutating(row.id, false);
      }
    }, 5000);
  };

  const removeCategory = async (row: ServiceCategory) => {
    const actionKey = `delete:${row.id}`;
    clearPendingAction(actionKey);
    notification.destroy(actionKey);
    const prevRows = rows;
    const index = rows.findIndex((c) => c.id === row.id);

    setRows((prev) => prev.filter((c) => c.id !== row.id));
    notification.open({
      key: actionKey,
      message: "Category removed",
      description: "Undo within 5 seconds before the deletion is committed.",
      duration: 5,
      btn: (
        <Button
          size="small"
          onClick={() => {
            clearPendingAction(actionKey);
            notification.destroy(actionKey);
            setRows((prev) => {
              const next = [...prev];
              const safeIndex = index >= 0 ? index : prev.length;
              next.splice(safeIndex, 0, row);
              return next;
            });
          }}
        >
          Undo
        </Button>
      ),
    });

    pendingActionTimers.current[actionKey] = setTimeout(async () => {
      clearPendingAction(actionKey);
      notification.destroy(actionKey);
      try {
        await api.deleteAdminServiceCategory(row.id);
        message.success("Category deleted");
      } catch (e) {
        setRows(prevRows);
        message.error(formatApiMessage(e));
      }
    }, 5000);
  };

  const columns: ColumnsType<ServiceCategory> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {record.translations?.en?.name || text}
          </Typography.Text>
          {record.translations?.ar?.name ? (
            <Typography.Text className="cat-slug-muted" dir="rtl">
              {record.translations.ar.name}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary" className="cat-slug-muted">
            /{record.slug}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "Icon",
      key: "icons",
      width: 160,
      render: (_, r) => {
        if (!r.iconKey?.trim()) return "—";
        const FaIcon = getCategoryFa5Icon(r.iconKey);
        return (
          <Space size={8} wrap className="svc-cat-icon-cell">
            {FaIcon ? (
              <FaIcon className="svc-cat-table-fa" aria-hidden />
            ) : null}
            <Tag>{r.iconKey}</Tag>
          </Space>
        );
      },
    },
    {
      title: "Order",
      dataIndex: "sortOrder",
      key: "sortOrder",
      width: 88,
      sorter: (a, b) => a.sortOrder - b.sortOrder,
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      width: 120,
      render: (active: boolean) =>
        active ? (
          <Tag color="success">Active</Tag>
        ) : (
          <Tag color="default">Inactive</Tag>
        ),
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 120,
      render: (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    },
    {
      title: "Actions",
      key: "actions",
      width: 240,
      render: (_, row) => (
        <Space wrap>
          <Tooltip title={row.active ? "Deactivate" : "Activate"}>
            <Switch
              checked={row.active}
              loading={!!mutatingIds[row.id]}
              checkedChildren="On"
              unCheckedChildren="Off"
              onChange={(checked) => void toggleActive(row, checked)}
            />
          </Tooltip>
          <Tooltip title="Edit category">
            <Button
              icon={<EditOutlined />}
              disabled={!!mutatingIds[row.id]}
              onClick={() => openEdit(row)}
              shape="circle"
              className="svc-cat-icon-btn svc-cat-icon-btn-ghost"
              aria-label="Edit category"
            />
          </Tooltip>
          <Popconfirm
            title="Delete category?"
            description="This fails if services are still assigned to it."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => void removeCategory(row)}
          >
            <Tooltip title="Delete category">
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={!!mutatingIds[row.id]}
                shape="circle"
                className="svc-cat-icon-btn"
                aria-label="Delete category"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="svc-cat-page">
      <Card className="svc-cat-card" variant="borderless">
        <div className="svc-cat-toolbar">
          <Space wrap>
            <Tooltip title="New category">
              <Button
                type="primary"
                size="large"
                shape="circle"
                icon={<AppstoreAddOutlined />}
                onClick={openCreate}
                className="svc-cat-icon-btn"
                aria-label="New category"
              />
            </Tooltip>
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
              className="svc-cat-icon-btn svc-cat-icon-btn-ghost"
              aria-label="Refresh categories"
            />
          </Tooltip>
        </div>

        <Table<ServiceCategory>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          rowClassName={(row) =>
            mutatingIds[row.id]
              ? "svc-cat-row-mutating svc-cat-row-skeleton"
              : ""
          }
          pagination={{ pageSize: 10, showSizeChanger: true }}
          className="svc-cat-table"
        />
      </Card>

      <Modal
        title={
          <Space>
            <AppstoreAddOutlined className="svc-cat-modal-icon" />
            <span>
              {editingCategory
                ? "Edit service category"
                : "New service category"}
            </span>
          </Space>
        }
        open={modalOpen}
        onCancel={closeModal}
        afterOpenChange={onModalOpenChange}
        width={560}
        destroyOnClose
        className="svc-cat-modal"
        okText={editingCategory ? "Save changes" : "Create category"}
        okButtonProps={{ loading: submitting }}
        onOk={() => void submitSave()}
      >
        <Typography.Paragraph type="secondary" className="svc-cat-modal-intro">
          Required field is the display name. The slug can be omitted—the API
          derives one from the name and ensures uniqueness.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            name="nameEn"
            label="English name"
            rules={[
              { required: true, message: "Enter an English category name" },
              { max: 120, message: "Max 120 characters" },
            ]}
          >
            <Input
              size="large"
              placeholder="e.g. Home cleaning"
              showCount
              maxLength={120}
            />
          </Form.Item>
          <Form.Item
            name="nameAr"
            label="Arabic name (optional)"
            rules={[{ max: 120, message: "Max 120 characters" }]}
          >
            <Input
              size="large"
              dir="rtl"
              placeholder="مثال: تنظيف المنزل"
              showCount
              maxLength={120}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug (optional)"
            tooltip="Lowercase letters, numbers, single hyphens. Leave empty to auto-generate."
            rules={[
              {
                validator: async (_, value) => {
                  const v = String(value ?? "").trim();
                  if (!v) return;
                  const lower = v.toLowerCase();
                  if (!SLUG_PATTERN.test(lower)) {
                    throw new Error(
                      "Use lowercase letters, numbers, and single hyphens only",
                    );
                  }
                },
              },
            ]}
          >
            <Input
              size="large"
              placeholder="auto from name"
              addonBefore="/"
              suffix={<LinkOutlined className="svc-cat-input-suffix" />}
            />
          </Form.Item>

          <div className="svc-cat-slug-preview">
            <Typography.Text type="secondary">
              Preview key:{" "}
              <Typography.Text code className="svc-cat-slug-code">
                {slugPreview}
              </Typography.Text>
            </Typography.Text>
          </div>

          <Form.Item
            name="iconKey"
            label="Category icon (optional)"
            tooltip="Font Awesome 5 glyph name used by the mobile app when no image URL is set."
          >
            <CategoryIconPickerField />
          </Form.Item>

          <Form.Item
            name="iconUrl"
            label="Icon URL (optional)"
            rules={[
              {
                validator: async (_, v) => {
                  const s = String(v ?? "").trim();
                  if (!s) return;
                  try {
                    void new URL(s);
                  } catch {
                    throw new Error("Enter a valid URL");
                  }
                },
              },
            ]}
          >
            <Input size="large" placeholder="https://…" maxLength={2048} />
          </Form.Item>

          <Form.Item name="sortOrder" label="Sort order">
            <InputNumber
              min={0}
              max={999999}
              className="svc-cat-sort"
              placeholder="0"
            />
          </Form.Item>

          <Form.Item
            name="active"
            label="Visible in marketplace"
            valuePropName="checked"
            initialValue
          >
            <Switch checkedChildren="Active" unCheckedChildren="Hidden" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
