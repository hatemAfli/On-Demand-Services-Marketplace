import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
  User,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { App, Image, Input, Modal, Spin } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../../services/api";
import type {
  AdminUserDetail,
  AdminUserGivenService,
} from "../../../../types/admin-user-detail";
import type { AccountStatus, UserRole } from "../../../../types/user";
import "./UsersDetailsPage.css";

const { TextArea } = Input;

function formatApiMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string") return msg;
  return (err as Error)?.message || "Something went wrong";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = dayjs(iso);
  return d.isValid() ? d.format("D MMM YYYY, HH:mm") : "—";
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = dayjs(iso);
  return d.isValid() ? d.format("D MMM YYYY") : "—";
}

function initials(first: string, last: string): string {
  return (
    `${(first || "").charAt(0)}${(last || "").charAt(0)}`.toUpperCase() || "?"
  );
}

function roleMeta(role: UserRole): { className: string; label: string } {
  switch (role) {
    case "CLIENT":
      return { className: "ud-role-client", label: "Client" };
    case "PROVIDER":
      return { className: "ud-role-provider", label: "Provider" };
    case "COMPANY_ADMIN":
      return { className: "ud-role-company", label: "Company admin" };
    case "PLATFORM_ADMIN":
      return { className: "ud-role-admin", label: "Platform admin" };
    default:
      return { className: "", label: role };
  }
}

function statusClass(status: AccountStatus): string {
  switch (status) {
    case "ACTIVE":
      return "ud-status-active";
    case "PENDING":
      return "ud-status-pending";
    case "REJECTED":
      return "ud-status-rejected";
    case "SUSPENDED":
      return "ud-status-suspended";
    case "DELETED":
      return "ud-status-deleted";
    default:
      return "ud-status-deleted";
  }
}

function statusLabel(status: AccountStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function Panel({
  title,
  icon: Icon,
  children,
  flush,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="ud-panel">
      <header className="ud-panel__head">
        <span className="ud-panel__icon">
          <Icon size={17} />
        </span>
        <h2 className="ud-panel__title">{title}</h2>
      </header>
      <div
        className={`ud-panel__body${flush ? " ud-panel__body--flush" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  full,
  muted,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`ud-info-row${full ? " ud-info-row--full" : ""}`}>
      <dt className="ud-info-row__label">{label}</dt>
      <dd
        className={`ud-info-row__value${muted ? " ud-info-row__value--muted" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function InfoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={`ud-info-grid${className ? ` ${className}` : ""}`}>
      {children}
    </dl>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="ud-stat">
      <span className="ud-stat__icon">
        <Icon size={15} />
      </span>
      <span className="ud-stat__value">{value}</span>
      <span className="ud-stat__label">{label}</span>
    </div>
  );
}

function VerifyChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "ud-verify-yes" : "ud-verify-no"}>
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
      {label}
    </span>
  );
}

export function UsersDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    status: AccountStatus;
    title: string;
  } | null>(null);
  const [statusReason, setStatusReason] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getAdminUserById(id);
      setUser(res.data);
    } catch (err) {
      message.error(formatApiMessage(err));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Copied to clipboard");
    } catch {
      message.error("Could not copy");
    }
  };

  const applyStatus = async (status: AccountStatus, reason?: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.updateAdminUserStatus(id, {
        status,
        reason: reason?.trim() || undefined,
      });
      message.success("Account status updated");
      setStatusModal(null);
      setStatusReason("");
      await load();
    } catch (err) {
      message.error(formatApiMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const openStatusModal = (status: AccountStatus, title: string) => {
    setStatusModal({ status, title });
    setStatusReason("");
  };

  if (loading) {
    return (
      <div className="ud ud--centered">
        <Spin size="large" />
      </div>
    );
  }

  if (!user || !id) {
    return (
      <div className="ud ud--centered">
        <p>User not found.</p>
        <button
          type="button"
          className="ud-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
      </div>
    );
  }

  const role = roleMeta(user.role);
  const displayName = `${user.firstName} ${user.lastName}`.trim();
  const photoUrl =
    user.provider?.photoUrl ?? user.client?.imageUrl ?? null;
  const isDeleted = user.status === "DELETED";
  const isPlatformAdmin = user.role === "PLATFORM_ADMIN";
  const canManage = !isPlatformAdmin && !isDeleted;

  const allDocuments = user.verificationRequests.flatMap((vr) =>
    vr.documents.map((d) => ({
      ...d,
      requestStatus: vr.requestStatus,
      serviceName: vr.service?.name ?? "Company verification",
    })),
  );

  const stats = [
    user.stats.appointments != null
      ? { key: "appointments", icon: Calendar, value: user.stats.appointments, label: "Appointments" }
      : null,
    user.stats.reviews != null
      ? { key: "reviews", icon: Star, value: user.stats.reviews, label: "Reviews" }
      : null,
    user.stats.complaints != null
      ? { key: "complaints", icon: Shield, value: user.stats.complaints, label: "Complaints" }
      : null,
    user.stats.givenServices != null
      ? { key: "services", icon: Briefcase, value: user.stats.givenServices, label: "Services" }
      : null,
  ].filter(Boolean) as {
    key: string;
    icon: LucideIcon;
    value: number;
    label: string;
  }[];

  return (
    <div className="ud">
      <section className="ud-hero">
        <div className="ud-hero__inner">
          <button
            type="button"
            className="ud-back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="ud-hero__profile">
            <div className="ud-avatar" aria-hidden>
              {photoUrl ? (
                <img src={photoUrl} alt="" />
              ) : (
                initials(user.firstName, user.lastName)
              )}
            </div>

            <div className="ud-hero__main">
              <div className="ud-hero__title-row">
                <h1 className="ud-hero__title">{displayName}</h1>
                <span className={`ud-role-pill ${role.className}`}>
                  {role.label}
                </span>
                <span className={`ud-status-pill ${statusClass(user.status)}`}>
                  {statusLabel(user.status)}
                </span>
              </div>

              <div className="ud-hero__meta">
                <button
                  type="button"
                  className="ud-meta-item ud-meta-item--copy"
                  onClick={() => void copyText(user.email)}
                  title="Click to copy"
                >
                  <Mail size={14} />
                  {user.email}
                </button>
                {user.phoneNumber ? (
                  <button
                    type="button"
                    className="ud-meta-item ud-meta-item--copy"
                    onClick={() => void copyText(user.phoneNumber!)}
                    title="Click to copy"
                  >
                    <Phone size={14} />
                    {user.phoneNumber}
                  </button>
                ) : null}
                <span className="ud-meta-item">
                  <Calendar size={14} />
                  Joined {formatShortDate(user.createdAt)}
                </span>
              </div>

              <div className="ud-verify-row">
                <VerifyChip ok={user.isEmailVerified} label="Email verified" />
                <VerifyChip ok={user.isPhoneVerified} label="Phone verified" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ud-layout">
        <main className="ud-main">
          {stats.length > 0 ? (
            <div className="ud-stats">
              {stats.map((s) => (
                <StatCard
                  key={s.key}
                  icon={s.icon}
                  value={s.value}
                  label={s.label}
                />
              ))}
            </div>
          ) : null}

          <div className="ud-compact-row">
            <Panel title="Account overview" icon={User}>
              <InfoGrid className="ud-info-grid--single">
                <InfoRow label="User ID" value={user.id} muted full />
                <InfoRow label="Phone" value={user.phoneNumber ?? "—"} full />
                <InfoRow
                  label="Last updated"
                  value={formatDate(user.updatedAt)}
                  full
                />
                {user.deletedAt ? (
                  <InfoRow
                    label="Deleted at"
                    value={formatDate(user.deletedAt)}
                    full
                  />
                ) : null}
              </InfoGrid>
            </Panel>

            <Panel title="Verification requests" icon={FileText}>
              {user.verificationRequests.length > 0 ? (
                <ul className="ud-verify-list">
                  {user.verificationRequests.map((r) => (
                    <li key={r.id} className="ud-verify-list__item">
                      <div className="ud-verify-list__main">
                        <span className="ud-verify-list__name">
                          {r.service?.name ?? r.ownerType}
                        </span>
                        <span className="ud-chip">{r.requestStatus}</span>
                      </div>
                      <div className="ud-verify-list__meta">
                        <span>{formatShortDate(r.createdAt)}</span>
                        <span>·</span>
                        <span>{r.documents.length} doc(s)</span>
                        <Link
                          className="ud-table__link"
                          to="/admin/validations/history"
                        >
                          Queue
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ud-panel__empty">No verification requests.</p>
              )}
            </Panel>

            <Panel title="Uploaded documents" icon={FileText}>
              {allDocuments.length > 0 ? (
                <div className="ud-docs ud-docs--compact">
                  {allDocuments.map((d) => (
                    <a
                      key={d.id}
                      href={d.fichierUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ud-doc"
                    >
                      <img
                        src={d.fichierUrl}
                        alt={d.type}
                        className="ud-doc__thumb"
                      />
                      <span className="ud-doc__type">{d.type}</span>
                      <span
                        className={`ud-doc__status ${
                          d.isAccepted === true
                            ? "ud-doc__status--ok"
                            : d.isAccepted === false
                              ? "ud-doc__status--no"
                              : "ud-doc__status--wait"
                        }`}
                      >
                        {d.isAccepted === true
                          ? "Accepted"
                          : d.isAccepted === false
                            ? "Rejected"
                            : "Pending"}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="ud-panel__empty">No documents uploaded.</p>
              )}
            </Panel>
          </div>

          {user.client ? (
            <Panel title="Client profile" icon={MapPin}>
              <InfoGrid>
                <InfoRow label="City" value={user.client.city} />
                <InfoRow
                  label="Address"
                  value={user.client.address ?? "—"}
                  muted={!user.client.address}
                />
                <InfoRow
                  label="Profile created"
                  value={formatShortDate(user.client.createdAt)}
                />
              </InfoGrid>
              {user.client.imageUrl ? (
                <Image
                  src={user.client.imageUrl}
                  alt="Client profile"
                  className="ud-profile-img"
                  width={96}
                  height={96}
                />
              ) : null}
            </Panel>
          ) : null}

          {user.provider ? (
            <Panel title="Provider profile" icon={Briefcase}>
              <InfoGrid>
                <InfoRow
                  label="Type"
                  value={
                    <span
                      className={`ud-chip ${user.provider.type === "EMPLOYEE" ? "ud-chip--purple" : "ud-chip--blue"}`}
                    >
                      {user.provider.type === "EMPLOYEE"
                        ? "Employee"
                        : "Independent"}
                    </span>
                  }
                />
                <InfoRow label="City" value={user.provider.city} />
                <InfoRow
                  label="Address"
                  value={user.provider.address ?? "—"}
                  muted={!user.provider.address}
                />
                <InfoRow
                  label="Experience"
                  value={
                    user.provider.yearsOfExperience != null
                      ? `${user.provider.yearsOfExperience} years`
                      : "—"
                  }
                />
                <InfoRow
                  label="Rating"
                  value={
                    user.provider.averageRating != null
                      ? `${user.provider.averageRating} ★ · ${user.provider.totalReviews} reviews`
                      : "—"
                  }
                />
                <InfoRow
                  label="Top provider"
                  value={user.provider.isTopProvider ? "Yes" : "No"}
                />
                <InfoRow
                  label="Complaints"
                  value={`${user.provider.totalComplaints} total · ${user.provider.activeComplaints} active`}
                />
                <InfoRow
                  label="Languages"
                  value={user.provider.languagesSpoken.join(", ") || "—"}
                  muted={user.provider.languagesSpoken.length === 0}
                />
                <InfoRow
                  label="Payment methods"
                  value={user.provider.paymentMethodsAccepted.join(", ") || "—"}
                  muted={user.provider.paymentMethodsAccepted.length === 0}
                  full
                />
              </InfoGrid>

              {user.provider.tagline ? (
                <p className="ud-tagline" style={{ marginTop: 14 }}>
                  “{user.provider.tagline}”
                </p>
              ) : null}
              {user.provider.bio ? (
                <p className="ud-bio">{user.provider.bio}</p>
              ) : null}

              {user.provider.company ? (
                <div className="ud-nested">
                  <h3 className="ud-nested__title">Employer company</h3>
                  <InfoGrid>
                    <InfoRow
                      label="Name"
                      value={user.provider.company.companyName}
                    />
                    <InfoRow
                      label="Tax ID"
                      value={user.provider.company.taxId}
                    />
                    <InfoRow label="City" value={user.provider.company.city} />
                    <InfoRow
                      label="Email"
                      value={user.provider.company.email ?? "—"}
                      muted={!user.provider.company.email}
                    />
                  </InfoGrid>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {user.companyAdmin?.company ? (
            <Panel title="Company administration" icon={Building2}>
              <InfoGrid>
                <InfoRow
                  label="Company"
                  value={user.companyAdmin.company.companyName}
                />
                <InfoRow
                  label="Tax ID"
                  value={user.companyAdmin.company.taxId}
                />
                <InfoRow label="City" value={user.companyAdmin.company.city} />
                <InfoRow
                  label="Email"
                  value={user.companyAdmin.company.email ?? "—"}
                  muted={!user.companyAdmin.company.email}
                />
                <InfoRow
                  label="Rating"
                  value={
                    user.companyAdmin.company.averageRating != null
                      ? `${user.companyAdmin.company.averageRating} ★`
                      : "—"
                  }
                />
              </InfoGrid>

              <h3 className="ud-panel__subhead">
                Employees ({user.companyAdmin.company.providers.length})
              </h3>

              {user.companyAdmin.company.providers.length > 0 ? (
                <table className="ud-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>City</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {user.companyAdmin.company.providers.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.user.firstName} {r.user.lastName}
                        </td>
                        <td>{r.user.email}</td>
                        <td>{r.city}</td>
                        <td>
                          <span
                            className={`ud-status-pill ${statusClass(r.user.status)}`}
                          >
                            {statusLabel(r.user.status)}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="ud-table__link"
                            to={`/admin/users/${r.id}`}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="ud-table__empty">No employees linked yet.</p>
              )}
            </Panel>
          ) : null}

          {user.platformAdmin ? (
            <Panel title="Platform admin" icon={Shield}>
              <InfoGrid>
                <InfoRow
                  label="Permissions"
                  value={
                    user.platformAdmin.permissions.length > 0
                      ? user.platformAdmin.permissions.join(", ")
                      : "Default (full access)"
                  }
                  full
                />
              </InfoGrid>
            </Panel>
          ) : null}

          {user.givenServices.length > 0 ? (
            <Panel title="Given services" icon={Briefcase} flush>
              <table className="ud-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {user.givenServices.map((s: AdminUserGivenService) => (
                    <tr key={s.id}>
                      <td>{s.serviceName}</td>
                      <td>{s.categoryName ?? "—"}</td>
                      <td>
                        {s.price}{" "}
                        <span className="ud-info-row__value--muted">
                          ({s.pricingType})
                        </span>
                      </td>
                      <td>
                        {s.averageRating != null
                          ? `${s.averageRating} ★ (${s.totalReviews ?? 0})`
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`ud-status-pill ${s.active ? "ud-status-active" : "ud-status-deleted"}`}
                        >
                          {s.active ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}
        </main>

        <aside className="ud-aside">
          {isPlatformAdmin ? (
            <div className="ud-notice ud-notice--warn">
              Platform administrator accounts cannot be modified from this
              screen.
            </div>
          ) : null}

          {canManage ? (
            <div className="ud-actions">
              <div className="ud-actions__head">Account actions</div>
              <div className="ud-actions__body">
                {user.status !== "ACTIVE" ? (
                  <button
                    type="button"
                    className="ud-actions__btn ud-actions__btn--primary"
                    disabled={actionLoading}
                    onClick={() =>
                      openStatusModal("ACTIVE", "Activate account")
                    }
                  >
                    <CheckCircle2 size={15} />
                    Activate
                  </button>
                ) : null}
                {user.status === "ACTIVE" || user.status === "PENDING" ? (
                  <button
                    type="button"
                    className="ud-actions__btn"
                    disabled={actionLoading}
                    onClick={() =>
                      openStatusModal("SUSPENDED", "Suspend account")
                    }
                  >
                    Suspend
                  </button>
                ) : null}
                {user.status !== "REJECTED" && user.status !== "DELETED" ? (
                  <button
                    type="button"
                    className="ud-actions__btn ud-actions__btn--warn"
                    disabled={actionLoading}
                    onClick={() =>
                      openStatusModal("REJECTED", "Block account")
                    }
                  >
                    Block
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ud-actions__btn ud-actions__btn--danger"
                  disabled={actionLoading}
                  onClick={() =>
                    openStatusModal("DELETED", "Delete account permanently")
                  }
                >
                  Delete permanently
                </button>
              </div>
            </div>
          ) : null}

          <div className="ud-notice">
            <strong style={{ display: "block", marginBottom: 4, color: "#0f172a" }}>
              Quick reference
            </strong>
            Role: {role.label}
            <br />
            Status: {statusLabel(user.status)}
            <br />
            Member since {formatShortDate(user.createdAt)}
          </div>
        </aside>
      </div>

      <Modal
        title={statusModal?.title}
        open={statusModal != null}
        onCancel={() => !actionLoading && setStatusModal(null)}
        onOk={() =>
          statusModal && void applyStatus(statusModal.status, statusReason)
        }
        okText="Confirm"
        okButtonProps={{
          danger:
            statusModal?.status === "DELETED" ||
            statusModal?.status === "REJECTED",
        }}
        confirmLoading={actionLoading}
      >
        <p style={{ marginBottom: 12, fontSize: 13, color: "#64748b" }}>
          {statusModal?.status === "DELETED"
            ? "This will mark the account as deleted. The user will no longer be able to sign in."
            : statusModal?.status === "SUSPENDED"
              ? "The user will be suspended and cannot use the platform until reactivated."
              : statusModal?.status === "REJECTED"
                ? "The user will be blocked from accessing the platform."
                : "The user will be able to access the platform again."}
        </p>
        <TextArea
          rows={3}
          placeholder="Optional internal reason (recommended)…"
          value={statusReason}
          onChange={(e) => setStatusReason(e.target.value)}
          maxLength={2000}
        />
      </Modal>
    </div>
  );
}
