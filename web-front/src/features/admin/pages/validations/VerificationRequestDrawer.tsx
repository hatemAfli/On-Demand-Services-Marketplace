import {
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../../services/api";
import type {
  AdminVerificationDocument,
  AdminVerificationRequestItem,
  VerificationReviewStatus,
} from "../../../../types/verification-admin";
import "../users/UsersAdminPage.css";

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return (err as Error)?.message || "Something went wrong";
}

function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    IDENTITY: "Identity",
    LICENSE: "License",
    QUALIFICATION: "Qualification",
    INSURANCE: "Insurance",
    OTHER: "Other",
  };
  return map[type] ?? type;
}

function docReviewStatusLabel(doc: AdminVerificationDocument): string {
  if (doc.isAccepted === true) return "Accepted";
  if (doc.isAccepted === false) return "Rejected";
  return "Pending review";
}

function docStatusColor(doc: AdminVerificationDocument): string {
  if (doc.isAccepted === true) return "success";
  if (doc.isAccepted === false) return "error";
  return "default";
}

/** Same presets as mobile admin validation detail (`AdminValidationProviderDetailScreen`). */
const REJECT_PRESET_LABELS = [
  "Incomplete or missing information",
  "Document illegible or low quality",
  "Wrong document type for this category",
  "Expired or out-of-date document",
  "Does not match registered profile information",
] as const;

function statusColor(s: VerificationReviewStatus): string {
  switch (s) {
    case "PENDING":
      return "gold";
    case "UNDER_REVIEW":
      return "blue";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    default:
      return "default";
  }
}

type Props = {
  open: boolean;
  requestId: string | null;
  onClose: () => void;
  /** Called after approve / reject / mark review so lists and sidebar badges refresh */
  onAfterMutation: () => void;
};

export function VerificationRequestDrawer({
  open,
  requestId,
  onClose,
  onAfterMutation,
}: Props) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AdminVerificationRequestItem | null>(
    null,
  );
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectPreset, setRejectPreset] = useState<string | null>(null);
  const [rejectCustom, setRejectCustom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [docReviewActingId, setDocReviewActingId] = useState<string | null>(
    null,
  );
  const [docRejectOpen, setDocRejectOpen] = useState(false);
  const [docRejectTargetId, setDocRejectTargetId] = useState<string | null>(
    null,
  );
  const [docRejectReason, setDocRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const res = await api.getAdminVerificationRequest(requestId);
      setDetail(res.data);
    } catch (e) {
      message.error(formatApiMessage(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [requestId, message]);

  useEffect(() => {
    if (open && requestId) {
      void load();
    } else {
      setDetail(null);
      setRejectPreset(null);
      setRejectCustom("");
      setDocRejectOpen(false);
      setDocRejectTargetId(null);
      setDocRejectReason("");
      setDocReviewActingId(null);
    }
  }, [open, requestId, load]);

  const allDocsAccepted = useMemo(() => {
    if (!detail?.documents.length) return false;
    return detail.documents.every((d) => d.isAccepted === true);
  }, [detail]);

  const allDocsReviewed = useMemo(() => {
    if (!detail?.documents.length) return false;
    return detail.documents.every(
      (d) => d.isAccepted === true || d.isAccepted === false,
    );
  }, [detail]);

  const docSummary = useMemo(() => {
    if (!detail?.documents.length) {
      return { accepted: 0, pending: 0, rejected: 0 };
    }
    let accepted = 0;
    let pending = 0;
    let rejected = 0;
    for (const d of detail.documents) {
      if (d.isAccepted === true) accepted += 1;
      else if (d.isAccepted === false) rejected += 1;
      else pending += 1;
    }
    return { accepted, pending, rejected };
  }, [detail]);

  const runMutation = async (fn: () => Promise<unknown>) => {
    setSubmitting(true);
    try {
      await fn();
      message.success("Updated");
      onAfterMutation();
      await load();
      setRejectOpen(false);
      setRejectPreset(null);
      setRejectCustom("");
    } catch (e) {
      message.error(formatApiMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const patchDocumentsFromResponse = (
    updated: AdminVerificationRequestItem,
    documentId: string,
  ) => {
    setDetail((prev) => {
      if (!prev) return updated;
      const nextDoc = updated.documents.find((d) => d.id === documentId);
      if (!nextDoc) return { ...prev, documents: updated.documents };
      return {
        ...prev,
        documents: prev.documents.map((d) => (d.id === documentId ? nextDoc : d)),
      };
    });
  };

  const submitDocumentAccept = async (documentId: string) => {
    if (!detail) return;
    setDocReviewActingId(documentId);
    try {
      const res = await api.reviewVerificationDocument(detail.id, documentId, {
        decision: "accept",
      });
      patchDocumentsFromResponse(res.data, documentId);
      message.success("Document accepted");
    } catch (e) {
      message.error(formatApiMessage(e));
    } finally {
      setDocReviewActingId(null);
    }
  };

  const openDocumentReject = (documentId: string) => {
    setDocRejectTargetId(documentId);
    setDocRejectReason("");
    setDocRejectOpen(true);
  };

  const submitDocumentReject = async () => {
    if (!detail || !docRejectTargetId) return;
    const reason = docRejectReason.trim();
    if (!reason) {
      message.warning("Enter a short reason for rejecting this file");
      return;
    }
    setDocReviewActingId(docRejectTargetId);
    try {
      const res = await api.reviewVerificationDocument(detail.id, docRejectTargetId, {
        decision: "reject",
        rejectionReason: reason,
      });
      patchDocumentsFromResponse(res.data, docRejectTargetId);
      message.success("Document marked as rejected");
      setDocRejectOpen(false);
      setDocRejectTargetId(null);
      setDocRejectReason("");
    } catch (e) {
      message.error(formatApiMessage(e));
    } finally {
      setDocReviewActingId(null);
    }
  };

  const actionable =
    detail &&
    (detail.requestStatus === "PENDING" ||
      detail.requestStatus === "UNDER_REVIEW");

  const isAlreadyUnderReview = detail?.requestStatus === "UNDER_REVIEW";

  const applicantName = detail
    ? `${detail.user.firstName ?? ""} ${detail.user.lastName ?? ""}`.trim() ||
      "—"
    : "";

  const docProgressPercent =
    detail && detail.documents.length > 0
      ? Math.round((docSummary.accepted / detail.documents.length) * 100)
      : 0;

  return (
    <>
      <Drawer
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>Verification request</span>
            {detail ? (
              <Tag color={statusColor(detail.requestStatus)}>
                {detail.requestStatus}
              </Tag>
            ) : null}
          </Space>
        }
        placement="right"
        width={Math.min(
          720,
          typeof window !== "undefined" ? window.innerWidth - 24 : 720,
        )}
        onClose={onClose}
        open={open}
        destroyOnClose
        styles={{ body: { paddingBottom: 24 } }}
        extra={
          detail && actionable ? (
            <Space wrap>
              <Button
                icon={<EyeOutlined />}
                loading={submitting}
                disabled={isAlreadyUnderReview}
                onClick={() =>
                  void runMutation(() =>
                    api
                      .markVerificationUnderReview(detail.id)
                      .then(() => undefined),
                  )
                }
              >
                Mark under review
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                disabled={!allDocsAccepted || submitting}
                onClick={() => {
                  if (!detail || !allDocsAccepted) return;
                  void runMutation(() => api.approveVerificationRequest(detail.id));
                }}
              >
                Approve
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                disabled={!allDocsReviewed || submitting}
                onClick={() => {
                  setRejectPreset(null);
                  setRejectCustom("");
                  setRejectOpen(true);
                }}
              >
                Reject
              </Button>
            </Space>
          ) : null
        }
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : !detail ? (
          <Empty description="Could not load request" />
        ) : (
          <div>
            {detail.documents.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <Progress
                  percent={docProgressPercent}
                  success={{ percent: docProgressPercent }}
                  strokeColor="#faad14"
                  format={() =>
                    `${docSummary.accepted}/${detail.documents.length} accepted${
                      docSummary.rejected > 0
                        ? ` · ${docSummary.rejected} rejected`
                        : ""
                    }${docSummary.pending > 0 ? ` · ${docSummary.pending} pending` : ""}`
                  }
                />
              </div>
            ) : null}

            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: 160 }}
            >
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
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Account status">
                <Tag>{detail.user.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Owner type">
                <Tag color={detail.ownerType === "COMPANY" ? "purple" : "blue"}>
                  {detail.ownerType === "COMPANY" ? (
                    <>
                      <BankOutlined /> Company
                    </>
                  ) : (
                    "Provider"
                  )}
                </Tag>
              </Descriptions.Item>
              {detail.ownerType === "COMPANY" &&
              detail.user.companyAdmin?.company ? (
                <Descriptions.Item label="Company">
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>
                      {detail.user.companyAdmin.company.companyName}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {detail.user.companyAdmin.company.city}
                      {detail.user.companyAdmin.company.taxId
                        ? ` · Tax ID: ${detail.user.companyAdmin.company.taxId}`
                        : ""}
                    </Typography.Text>
                  </Space>
                </Descriptions.Item>
              ) : null}
              {detail.ownerType === "PROVIDER" && detail.user.provider ? (
                <Descriptions.Item label="Provider profile">
                  {detail.user.provider.city}
                  {detail.user.provider.address
                    ? ` · ${detail.user.provider.address}`
                    : ""}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="Service">
                {detail.service ? (
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>
                      {detail.service.name}
                    </Typography.Text>
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
                  <Typography.Paragraph
                    style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}
                  >
                    {detail.ownerComment}
                  </Typography.Paragraph>
                </Descriptions.Item>
              ) : null}
              {detail.requestStatus === "REJECTED" && detail.adminComment ? (
                <Descriptions.Item label="Rejection reason">
                  <Typography.Paragraph
                    style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}
                  >
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
              locale={{ emptyText: "No documents attached" }}
              renderItem={(doc, index) => (
                <List.Item
                  style={{
                    display: "block",
                    padding: "16px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      borderLeft: `4px solid ${
                        doc.isAccepted === true
                          ? "#52c41a"
                          : doc.isAccepted === false
                            ? "#ff4d4f"
                            : "#faad14"
                      }`,
                      paddingLeft: 12,
                    }}
                  >
                    <Space
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                      wrap
                    >
                      <Space>
                        <Tag>{index + 1}</Tag>
                        <Typography.Text strong>
                          {docTypeLabel(doc.type)}
                        </Typography.Text>
                        <Tag color={docStatusColor(doc)}>
                          {docReviewStatusLabel(doc)}
                        </Tag>
                      </Space>
                      <Button
                        type="link"
                        href={doc.fichierUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open file
                      </Button>
                    </Space>

                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, display: "block" }}
                    >
                      Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                      {doc.validatedAt
                        ? ` · Validated ${new Date(doc.validatedAt).toLocaleString()}`
                        : ""}
                    </Typography.Text>

                    {doc.rejectionReason ? (
                      <Alert
                        type="error"
                        showIcon
                        icon={<ExclamationCircleOutlined />}
                        message={doc.rejectionReason}
                        style={{ marginTop: 10, marginBottom: 0 }}
                      />
                    ) : null}

                    {actionable ? (
                      <Space style={{ marginTop: 12 }} wrap>
                        <Button
                          type="primary"
                          ghost
                          icon={<CheckCircleOutlined />}
                          loading={docReviewActingId === doc.id}
                          disabled={
                            docReviewActingId !== null ||
                            doc.isAccepted === true
                          }
                          onClick={() => void submitDocumentAccept(doc.id)}
                        >
                          Accept
                        </Button>
                        <Button
                          danger
                          ghost
                          icon={<CloseCircleOutlined />}
                          disabled={
                            docReviewActingId !== null ||
                            doc.isAccepted === false
                          }
                          onClick={() => openDocumentReject(doc.id)}
                        >
                          Reject
                        </Button>
                      </Space>
                    ) : null}
                  </div>
                </List.Item>
              )}
            />

            {actionable && !allDocsAccepted ? (
              <Alert
                type="warning"
                showIcon
                message="Accept every document before approving this request."
                style={{ marginTop: 8 }}
              />
            ) : null}
            {actionable && !allDocsReviewed ? (
              <Alert
                type="info"
                showIcon
                message="Review every document (accept or reject each file) before rejecting the request."
                style={{ marginTop: 8 }}
              />
            ) : null}
          </div>
        )}
      </Drawer>

      <Modal
        title="Reject verification"
        open={rejectOpen}
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !allDocsReviewed }}
        width={560}
        onOk={() => {
          if (!detail || !allDocsReviewed) return;
          const reason = (rejectCustom.trim() || rejectPreset || "").trim();
          if (!reason) {
            message.warning(
              "Select a reason or enter a custom rejection reason",
            );
            return;
          }
          void runMutation(() =>
            api.rejectVerificationRequest(detail.id, { reason }),
          );
        }}
        confirmLoading={submitting}
        onCancel={() => setRejectOpen(false)}
        destroyOnClose
      >
        {!allDocsReviewed ? (
          <Alert
            type="info"
            showIcon
            message="Review every document individually before rejecting the request."
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginBottom: 8 }}
        >
          Common reasons
        </Typography.Text>
        <Space wrap size="small" style={{ marginBottom: 16, width: "100%" }}>
          {REJECT_PRESET_LABELS.map((label) => (
            <Button
              key={label}
              size="small"
              type={rejectPreset === label ? "primary" : "default"}
              onClick={() => {
                setRejectPreset(label);
                setRejectCustom("");
              }}
            >
              {label}
            </Button>
          ))}
        </Space>
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginBottom: 8 }}
        >
          Custom reason
        </Typography.Text>
        <Input.TextArea
          rows={4}
          placeholder="Explain what is missing or incorrect…"
          value={rejectCustom}
          onChange={(e) => {
            const v = e.target.value;
            setRejectCustom(v);
            if (v.trim()) setRejectPreset(null);
          }}
          maxLength={4000}
          showCount
        />
      </Modal>

      <Modal
        title="Reject this document"
        open={docRejectOpen}
        okText="Reject file"
        okButtonProps={{ danger: true }}
        onOk={() => void submitDocumentReject()}
        confirmLoading={docReviewActingId !== null}
        onCancel={() => {
          setDocRejectOpen(false);
          setDocRejectTargetId(null);
          setDocRejectReason("");
        }}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Enter a short refusal reason for this file.
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          placeholder="Why is this file being rejected?"
          value={docRejectReason}
          onChange={(e) => setDocRejectReason(e.target.value)}
          maxLength={2000}
          showCount
        />
      </Modal>
    </>
  );
}
