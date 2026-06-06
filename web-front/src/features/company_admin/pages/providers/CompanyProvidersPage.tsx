import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";
import {
  FaArrowsRotate,
  FaArrowTrendUp,
  FaAward,
  FaBan,
  FaBriefcase,
  FaCalendar,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaEllipsisVertical,
  FaEnvelope,
  FaLocationDot,
  FaMagnifyingGlass,
  FaPhone,
  FaPlus,
  FaSpinner,
  FaStar,
  FaUserClock,
  FaUserGroup,
  FaUserTie,
  FaUsers,
  FaXmark,
} from "react-icons/fa6";
import "./CompanyProvidersPage.css";
import { EmployeeScheduleEditor } from "./EmployeeScheduleEditor";
import { companyApi } from "../../../../services/companyApi";
import type {
  CompanyEmployee,
  EmployeeDetail,
  InvitationRow,
  InvitationStatus,
  ProviderLookupResult,
} from "../../../../types/company";
import type { AccountStatus } from "../../../../types/user";

const PAGE_SIZE = 20;

type Tone = "green" | "blue" | "gray" | "yellow" | "red";

function num(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? parseFloat(value) : value ?? 0;
  return Number.isFinite(n as number) ? (n as number) : 0;
}

function initialsOf(first?: string, last?: string): string {
  const a = (first ?? "").trim();
  const b = (last ?? "").trim();
  const i = (a[0] ?? "") + (b[0] ?? "");
  return i.toUpperCase() || "?";
}

function statusMeta(status: AccountStatus): { tone: Tone; label: string } {
  switch (status) {
    case "ACTIVE":
      return { tone: "green", label: "Active" };
    case "PENDING":
      return { tone: "yellow", label: "Pending" };
    case "SUSPENDED":
      return { tone: "red", label: "Suspended" };
    case "REJECTED":
      return { tone: "red", label: "Rejected" };
    case "DELETED":
      return { tone: "gray", label: "Deleted" };
    default:
      return { tone: "gray", label: String(status) };
  }
}

function invitationMeta(status: InvitationStatus): { tone: Tone; label: string } {
  switch (status) {
    case "PENDING":
      return { tone: "yellow", label: "Pending" };
    case "ACCEPTED":
      return { tone: "green", label: "Accepted" };
    case "DECLINED":
      return { tone: "red", label: "Declined" };
    case "CANCELLED":
      return { tone: "gray", label: "Cancelled" };
    case "EXPIRED":
      return { tone: "gray", label: "Expired" };
    default:
      return { tone: "gray", label: status };
  }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtJoined(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function serviceNamesFromDetail(detail: EmployeeDetail | null): string[] {
  if (!detail?.appointments?.length) return [];
  const set = new Set<string>();
  for (const ap of detail.appointments) {
    const svc = ap.givenService?.service;
    if (!svc) continue;
    const t =
      svc.translations?.find((x) => x.language === "en")?.name ??
      svc.translations?.[0]?.name ??
      svc.name ??
      null;
    if (t) set.add(t);
  }
  return Array.from(set);
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg[0] ?? fallback;
    if (typeof msg === "string") return msg;
  }
  return fallback;
}

const SERVICE_DOT_TONES = ["purple", "blue", "green"] as const;

type CpValueLoaderProps = {
  loading: boolean;
  children: ReactNode;
  width?: number | string;
  height?: number;
  inline?: boolean;
  className?: string;
};

function CpValueLoader({
  loading,
  children,
  width = 48,
  height = 22,
  inline = false,
  className = "",
}: CpValueLoaderProps) {
  if (loading) {
    return (
      <span
        className={`cp-value-skeleton ${inline ? "cp-value-skeleton-inline" : ""} ${className}`.trim()}
        style={{ width, height }}
        aria-busy="true"
        aria-label="Loading"
        role="status"
      />
    );
  }
  return <>{children}</>;
}

function CpTableSkeletonRows({
  cols,
  rows = 5,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={`cp-sk-row-${rowIdx}`} className="cp-tr-skeleton" aria-hidden>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx}>
              {colIdx === 0 ? (
                <div className="cp-provider-cell">
                  <span className="cp-value-skeleton cp-avatar-skeleton" />
                  <div className="cp-skeleton-text-col">
                    <span className="cp-value-skeleton cp-skeleton-line-lg" />
                    <span className="cp-value-skeleton cp-skeleton-line-sm" />
                  </div>
                </div>
              ) : (
                <span
                  className={`cp-value-skeleton ${colIdx === cols - 1 ? "cp-skeleton-actions" : "cp-skeleton-line-md"}`}
                />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CompanyProvidersPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Data state ──
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  // ── Filter / paging state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // ── Tab state ──
  const [invitationsTabActive, setInvitationsTabActive] = useState(false);

  // ── Action state ──
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<InvitationRow | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"overview" | "schedule">("overview");
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [invitationDrawerOpen, setInvitationDrawerOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] =
    useState<InvitationRow | null>(null);

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<ProviderLookupResult | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(
    null,
  );
  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      setToast({ msg, type });
      window.setTimeout(() => setToast(null), 3200);
    },
    [],
  );

  // ── Debounce search ──
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  // ── Fetchers ──
  const fetchEmployees = useCallback(
    async (opts?: { listOnly?: boolean }) => {
      if (!opts?.listOnly) setLoading(true);
      try {
        const params: {
          search?: string;
          status?: string;
          take: number;
          skip: number;
        } = { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        if (!invitationsTabActive && statusFilter !== "all") {
          params.status = statusFilter;
        }
        const res = await companyApi.getEmployees(params);
        setEmployees(res.data?.items ?? []);
        setTotal(res.data?.total ?? 0);
      } catch {
        setEmployees([]);
        setTotal(0);
      } finally {
        if (!opts?.listOnly) setLoading(false);
      }
    },
    [debouncedSearch, statusFilter, page, invitationsTabActive],
  );

  const fetchInvitations = useCallback(async (opts?: { listOnly?: boolean }) => {
    if (!opts?.listOnly) setInvitationsLoading(true);
    try {
      const res = await companyApi.getMyInvitations();
      setInvitations(Array.isArray(res.data) ? res.data : []);
    } catch {
      setInvitations([]);
    } finally {
      if (!opts?.listOnly) setInvitationsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchEmployees({ listOnly: true }),
        fetchInvitations({ listOnly: true }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchInvitations, fetchEmployees]);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    void fetchInvitations();
  }, [fetchInvitations]);

  useEffect(() => {
    if (!selectedInvitation) return;
    const updated = invitations.find((i) => i.id === selectedInvitation.id);
    if (updated) setSelectedInvitation(updated);
  }, [invitations, selectedInvitation?.id]);

  // ── Derived stats ──
  const activeCount = useMemo(
    () => employees.filter((e) => e.user.status === "ACTIVE").length,
    [employees],
  );
  const avgRating = useMemo(() => {
    if (employees.length === 0) return 0;
    const sum = employees.reduce((acc, e) => acc + num(e.averageRating), 0);
    return sum / employees.length;
  }, [employees]);
  const pendingInvitations = useMemo(
    () => invitations.filter((i) => i.status === "PENDING").length,
    [invitations],
  );
  const visibleInvitations = useMemo(
    () =>
      statusFilter === "all"
        ? invitations
        : invitations.filter((i) => i.status === statusFilter),
    [invitations, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 1);
    const end = Math.min(totalPages, start + 2);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (!pages.includes(1)) pages.unshift(1);
    return Array.from(new Set(pages)).sort((a, b) => a - b);
  }, [page, totalPages]);

  /** Header stat cards & tab badges — initial load only */
  const employeesHeaderLoading = loading;
  const invitationsHeaderLoading = invitationsLoading;
  /** Tables & pagination — initial load + refresh button */
  const employeesListBusy =
    loading || (refreshing && !invitationsTabActive);
  const invitationsListBusy =
    invitationsLoading || (refreshing && invitationsTabActive);

  // ── Actions ──
  const closeInvitationDrawer = useCallback(() => {
    setInvitationDrawerOpen(false);
    setSelectedInvitation(null);
  }, []);

  const openInvitationDrawer = useCallback(
    (inv: InvitationRow) => {
      setDrawerOpen(false);
      setDetail(null);
      setSelectedInvitation(inv);
      setInvitationDrawerOpen(true);
    },
    [],
  );

  const openDrawer = useCallback(async (providerId: string) => {
    closeInvitationDrawer();
    setDrawerOpen(true);
    setDrawerTab("overview");
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await companyApi.getEmployeeById(providerId);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [closeInvitationDrawer]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerTab("overview");
    setDetail(null);
  }, []);

  useEffect(() => {
    if (searchParams.get("tab") === "invitations") {
      setInvitationsTabActive(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const invitationId = searchParams.get("invitation");
    if (!invitationId || invitationsLoading) return;
    const inv = invitations.find((i) => i.id === invitationId);
    if (!inv) return;
    setInvitationsTabActive(true);
    openInvitationDrawer(inv);
    const next = new URLSearchParams(searchParams);
    next.delete("invitation");
    next.delete("tab");
    setSearchParams(next, { replace: true });
  }, [
    searchParams,
    setSearchParams,
    invitations,
    invitationsLoading,
    openInvitationDrawer,
  ]);

  useEffect(() => {
    const providerId = searchParams.get("provider");
    if (!providerId) return;
    void openDrawer(providerId);
    const next = new URLSearchParams(searchParams);
    next.delete("provider");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openDrawer]);

  const handleRemoveEmployee = useCallback(async () => {
    if (!detail) return;
    const name = `${detail.user.firstName} ${detail.user.lastName}`.trim();
    setRemovingId(detail.id);
    try {
      await companyApi.removeEmployee(detail.id);
      showToast(`${name} removed from your team.`);
      setConfirmWithdraw(false);
      closeDrawer();
      await Promise.all([fetchEmployees(), fetchInvitations()]);
    } catch (err) {
      showToast(errorMessage(err, "Could not remove this provider."), "error");
    } finally {
      setRemovingId(null);
    }
  }, [detail, showToast, closeDrawer, fetchEmployees, fetchInvitations]);

  const handleCancelInvitation = useCallback(
    async (invitationId: string) => {
      setCancellingId(invitationId);
      try {
        await companyApi.cancelInvitation(invitationId);
        showToast("Invitation cancelled.");
        setConfirmCancel(null);
        if (selectedInvitation?.id === invitationId) {
          closeInvitationDrawer();
        }
        await fetchInvitations();
      } catch (err) {
        showToast(errorMessage(err, "Could not cancel invitation."), "error");
      } finally {
        setCancellingId(null);
      }
    },
    [showToast, fetchInvitations, selectedInvitation?.id, closeInvitationDrawer],
  );

  // ── Modal handlers ──
  const resetModal = useCallback(() => {
    setModalStep(1);
    setEmail("");
    setLookupError(null);
    setLookupResult(null);
    setMessage("");
    setSending(false);
    setLookupLoading(false);
  }, []);

  const openModal = useCallback(() => {
    resetModal();
    setModalOpen(true);
  }, [resetModal]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    resetModal();
  }, [resetModal]);

  const handleLookup = useCallback(async () => {
    const value = email.trim();
    if (!value) {
      setLookupError("Please enter an email address.");
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await companyApi.lookupProviderByEmail(value);
      setLookupResult(res.data);
      setModalStep(2);
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        if (status === 404) {
          setLookupError("No provider found with this email.");
        } else if (status === 409) {
          setLookupError("This provider is already part of a company team.");
        } else {
          setLookupError(errorMessage(err, "Could not look up this provider."));
        }
      } else {
        setLookupError("Could not look up this provider.");
      }
    } finally {
      setLookupLoading(false);
    }
  }, [email]);

  const handleSendInvitation = useCallback(async () => {
    if (!lookupResult) return;
    setSending(true);
    try {
      await companyApi.sendInvitation({
        email: email.trim(),
        message: message.trim() || undefined,
      });
      closeModal();
      setInvitationsTabActive(true);
      await fetchInvitations();
      showToast("Invitation sent!");
    } catch (err) {
      setSending(false);
      setLookupError(errorMessage(err, "Could not send invitation."));
    }
  }, [lookupResult, email, message, closeModal, fetchInvitations, showToast]);

  // ── Render helpers ──
  const renderAvatar = (
    photoUrl: string | null,
    first: string,
    last: string,
    tone: Tone,
    suspended: boolean,
  ) => (
    <div className="cp-avatar-wrap">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${first} ${last}`}
          className={suspended ? "grayscale" : ""}
        />
      ) : (
        <div className={`cp-avatar-fallback ${suspended ? "grayscale" : ""}`}>
          {initialsOf(first, last)}
        </div>
      )}
      <span className={`cp-online-dot ${tone}`} />
    </div>
  );

  return (
    <div className="cp-root">
      {/* Stats row */}
      <div className="cp-stats-grid">
        <article className="cp-stat-card cp-stat-hover-blue">
          <div>
            <p>Total Providers</p>
            <h3>
              <CpValueLoader loading={employeesHeaderLoading} width={56} height={28}>
                {total}
              </CpValueLoader>
            </h3>
            <span className="cp-trend-up">
              <FaArrowTrendUp /> Team members
            </span>
          </div>
          <div className="cp-stat-icon blue">
            <FaUsers />
          </div>
        </article>

        <article className="cp-stat-card cp-stat-hover-green">
          <div>
            <p>Currently Active</p>
            <h3>
              <CpValueLoader loading={employeesHeaderLoading} width={40} height={28}>
                {activeCount}
              </CpValueLoader>
            </h3>
            <span className="cp-sub-text">On the current page</span>
          </div>
          <div className="cp-stat-icon green">
            <FaBriefcase />
          </div>
        </article>

        <article className="cp-stat-card cp-stat-hover-yellow">
          <div>
            <p>Avg. Rating</p>
            <h3>
              <CpValueLoader loading={employeesHeaderLoading} width={48} height={28}>
                {avgRating.toFixed(1)}
              </CpValueLoader>
            </h3>
            <span className="cp-trend-yellow">
              <FaStar /> Team quality
            </span>
          </div>
          <div className="cp-stat-icon yellow">
            <FaAward />
          </div>
        </article>

        <article className="cp-stat-card cp-stat-hover-purple">
          <div>
            <p>Pending Invitations</p>
            <h3>
              <CpValueLoader loading={invitationsHeaderLoading} width={40} height={28}>
                {pendingInvitations}
              </CpValueLoader>
            </h3>
            <span
              className={`cp-link-text ${invitationsHeaderLoading ? "cp-link-text-disabled" : ""}`}
              onClick={() => !invitationsHeaderLoading && setInvitationsTabActive(true)}
            >
              Review invitations
            </span>
          </div>
          <div className="cp-stat-icon purple">
            <FaUserClock />
          </div>
        </article>
      </div>

      {/* Toolbar */}
      <div className="cp-toolbar">
        <div className="cp-toolbar-left">
          <div className="cp-search-wrap">
            <FaMagnifyingGlass className="cp-search-icon" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="cp-status-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {invitationsTabActive ? (
              <>
                <option value="all">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </>
            ) : (
              <>
                <option value="all">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="SUSPENDED">Suspended</option>
              </>
            )}
          </select>
          <button
            className="cp-btn-refresh"
            title="Refresh"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <FaArrowsRotate className={refreshing ? "cp-spin" : ""} />
          </button>
        </div>
        <div className="cp-toolbar-right">
          <button className="cp-btn-primary" onClick={openModal}>
            <FaPlus /> Invite Provider
          </button>
        </div>
      </div>

      {/* Active filters */}
      {(statusFilter !== "all" || debouncedSearch.trim()) && (
        <div className="cp-filters-row">
          <span className="cp-filters-label">Active Filters:</span>
          {statusFilter !== "all" && (
            <span className="cp-filter-tag purple">
              Status:{" "}
              {invitationsTabActive
                ? invitationMeta(statusFilter as InvitationStatus).label
                : statusMeta(statusFilter as AccountStatus).label}{" "}
              <button onClick={() => setStatusFilter("all")}>
                <FaXmark />
              </button>
            </span>
          )}
          {debouncedSearch.trim() && (
            <span className="cp-filter-tag gray">
              Search: {debouncedSearch.trim()}{" "}
              <button onClick={() => setSearchQuery("")}>
                <FaXmark />
              </button>
            </span>
          )}
          <button
            className="cp-clear-filters"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setPage(1);
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="cp-tabs">
        <button
          className={`cp-tab ${!invitationsTabActive ? "active" : ""}`}
          onClick={() => {
            setInvitationsTabActive(false);
            setStatusFilter("all");
            setPage(1);
          }}
        >
          <FaUserGroup /> Team members
          <span className="cp-tab-badge">
            <CpValueLoader loading={employeesHeaderLoading} width={28} height={16} inline>
              {total}
            </CpValueLoader>
          </span>
        </button>
        <button
          className={`cp-tab ${invitationsTabActive ? "active" : ""}`}
          onClick={() => {
            setInvitationsTabActive(true);
            setStatusFilter("all");
          }}
        >
          <FaEnvelope /> Invitations
          <span className="cp-tab-badge">
            <CpValueLoader loading={invitationsHeaderLoading} width={28} height={16} inline>
              {invitations.length}
            </CpValueLoader>
          </span>
        </button>
      </div>

      {/* ── Team members tab ── */}
      {!invitationsTabActive && (
        <div className="cp-table-card">
          <div className="cp-table-scroll">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Provider Details</th>
                  <th>Status</th>
                  <th>City</th>
                  <th>Rating</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeesListBusy ? (
                  <CpTableSkeletonRows cols={5} />
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="cp-empty-state">
                        <FaUsers className="cp-empty-icon" />
                        <p>No providers found</p>
                        <small>
                          Invite a provider to start building your team.
                        </small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map((p) => {
                    const meta = statusMeta(p.user.status);
                    const suspended =
                      p.user.status === "SUSPENDED" ||
                      p.user.status === "REJECTED";
                    const name = `${p.user.firstName} ${p.user.lastName}`.trim();
                    return (
                      <tr
                        key={p.id}
                        className={`cp-tr ${suspended ? "suspended" : ""}`}
                        onClick={() => openDrawer(p.id)}
                      >
                        <td>
                          <div className="cp-provider-cell">
                            {renderAvatar(
                              p.photoUrl,
                              p.user.firstName,
                              p.user.lastName,
                              meta.tone,
                              suspended,
                            )}
                            <div>
                              <div
                                className={`cp-provider-name ${suspended ? "muted" : ""}`}
                              >
                                {name}
                              </div>
                              <div className="cp-provider-sub">
                                #{p.id.slice(0, 8)} • {p.user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`cp-status-pill ${meta.tone}`}>
                            {meta.tone === "red" ? (
                              <FaBan className="cp-pill-icon" />
                            ) : (
                              <span className={`cp-dot ${meta.tone}`} />
                            )}
                            {meta.label}
                          </span>
                        </td>

                        <td>
                          <span className="cp-last-active">
                            {p.city || "—"}
                          </span>
                        </td>

                        <td>
                          <div className="cp-rating-cell">
                            <FaStar className={suspended ? "star-muted" : "star"} />
                            <span
                              className={`cp-rating-val ${suspended ? "muted" : ""}`}
                            >
                              {num(p.averageRating).toFixed(1)}
                            </span>
                            <span className="cp-rating-sub">
                              ({p.totalReviews} reviews)
                            </span>
                          </div>
                        </td>

                        <td className="right" onClick={(e) => e.stopPropagation()}>
                          <div className="cp-row-actions">
                            <button
                              title="View details"
                              onClick={() => openDrawer(p.id)}
                            >
                              <FaCalendar />
                            </button>
                            <button title="More" onClick={() => openDrawer(p.id)}>
                              <FaEllipsisVertical />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="cp-pagination">
            <span>
              <CpValueLoader loading={employeesListBusy} width={220} height={14} inline>
                <>
                  Showing{" "}
                  <strong>
                    {rangeStart}–{rangeEnd}
                  </strong>{" "}
                  of <strong>{total}</strong> providers
                </>
              </CpValueLoader>
            </span>
            <div className={`cp-page-btns ${employeesListBusy ? "cp-page-btns-loading" : ""}`}>
              <button
                disabled={employeesListBusy || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FaChevronLeft />
              </button>
              {employeesListBusy ? (
                <span className="cp-value-skeleton cp-pagination-skeleton" />
              ) : (
                pageNumbers.map((n, idx) => {
                  const prev = pageNumbers[idx - 1];
                  const gap = prev !== undefined && n - prev > 1;
                  return (
                    <span key={n} style={{ display: "inline-flex", gap: 6 }}>
                      {gap ? <span>…</span> : null}
                      <button
                        className={n === page ? "active" : ""}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    </span>
                  );
                })
              )}
              <button
                disabled={employeesListBusy || page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <FaChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invitations tab ── */}
      {invitationsTabActive && (
        <div className="cp-table-card">
          <div className="cp-table-scroll">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Sent date</th>
                  <th>Expires</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitationsListBusy ? (
                  <CpTableSkeletonRows cols={6} />
                ) : visibleInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="cp-empty-state">
                        <FaEnvelope className="cp-empty-icon" />
                        <p>
                          {invitations.length === 0
                            ? "No invitations yet"
                            : "No invitations match this filter"}
                        </p>
                        <small>
                          {invitations.length === 0
                            ? "Invitations you send to providers will appear here."
                            : "Try a different status filter."}
                        </small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleInvitations.map((inv) => {
                    const meta = invitationMeta(inv.status);
                    const name =
                      `${inv.provider.user.firstName} ${inv.provider.user.lastName}`.trim();
                    return (
                      <tr
                        key={inv.id}
                        className="cp-tr"
                        onClick={() => openInvitationDrawer(inv)}
                      >
                        <td>
                          <div className="cp-provider-cell">
                            {renderAvatar(
                              inv.provider.photoUrl,
                              inv.provider.user.firstName,
                              inv.provider.user.lastName,
                              meta.tone,
                              false,
                            )}
                            <div>
                              <div className="cp-provider-name">{name}</div>
                              <div className="cp-provider-sub">
                                {inv.provider.city || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="cp-last-active">
                            {inv.provider.user.email}
                          </span>
                        </td>
                        <td>
                          <span className={`cp-status-pill ${meta.tone}`}>
                            <span className={`cp-dot ${meta.tone}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <span className="cp-last-active">
                            {fmtDate(inv.createdAt)}
                          </span>
                        </td>
                        <td>
                          <span className="cp-last-active">
                            {fmtDate(inv.expiresAt)}
                          </span>
                        </td>
                        <td className="right" onClick={(e) => e.stopPropagation()}>
                          {inv.status === "PENDING" ? (
                            <button
                              className="cp-btn-cancel"
                              disabled={cancellingId === inv.id}
                              onClick={() => setConfirmCancel(inv)}
                            >
                              {cancellingId === inv.id ? (
                                <FaSpinner className="cp-spin" />
                              ) : (
                                "Cancel"
                              )}
                            </button>
                          ) : (
                            <span className="cp-rating-sub">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="cp-footer">
        <span>© 2026 ServeMe Inc. All rights reserved.</span>
        <div>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Help Center</a>
        </div>
      </footer>

      {/* Provider Details Drawer */}
      {drawerOpen ? (
        <>
          <div className="cp-drawer-backdrop" onClick={closeDrawer} />
          <aside className="cp-drawer">
            <div className="cp-drawer-header">
              <h2>Provider Details</h2>
              <div className="cp-drawer-head-actions">
                <button onClick={closeDrawer} title="Close">
                  <FaXmark />
                </button>
              </div>
            </div>

            {detailLoading || !detail ? (
              <div className="cp-drawer-body cp-drawer-body-loading">
                <div className="cp-drawer-profile">
                  <span className="cp-value-skeleton cp-drawer-avatar-sk" />
                  <div className="cp-skeleton-text-col">
                    <span className="cp-value-skeleton cp-skeleton-line-lg" />
                    <span className="cp-value-skeleton cp-skeleton-line-sm" />
                    <span className="cp-value-skeleton cp-skeleton-line-md" />
                  </div>
                </div>
                <div className="cp-drawer-quick-stats">
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <span className="cp-value-skeleton cp-skeleton-line-sm" />
                      <span className="cp-value-skeleton cp-skeleton-line-md" />
                    </div>
                  ))}
                </div>
                <div className="cp-drawer-section">
                  <span className="cp-value-skeleton cp-skeleton-line-sm" />
                  <span className="cp-value-skeleton cp-skeleton-line-lg" />
                  <span className="cp-value-skeleton cp-skeleton-line-lg" />
                </div>
                <div className="cp-drawer-section">
                  <span className="cp-value-skeleton cp-skeleton-line-sm" />
                  <span className="cp-value-skeleton cp-skeleton-line-md" />
                </div>
              </div>
            ) : (
              <>
                <div className="cp-drawer-subtabs">
                  <button
                    type="button"
                    className={drawerTab === "overview" ? "active" : ""}
                    onClick={() => setDrawerTab("overview")}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    className={drawerTab === "schedule" ? "active" : ""}
                    onClick={() => setDrawerTab("schedule")}
                  >
                    <FaCalendar /> Schedule
                  </button>
                </div>

                {drawerTab === "overview" ? (
                <div className="cp-drawer-body">
                  <div className="cp-drawer-profile">
                    <div className="cp-drawer-avatar-wrap">
                      {detail.photoUrl ? (
                        <img
                          src={detail.photoUrl}
                          alt={`${detail.user.firstName} ${detail.user.lastName}`}
                        />
                      ) : (
                        <div className="cp-drawer-avatar-fallback">
                          {initialsOf(
                            detail.user.firstName,
                            detail.user.lastName,
                          )}
                        </div>
                      )}
                      <span className="cp-drawer-online">
                        <FaCheck />
                      </span>
                    </div>
                    <div>
                      <h3>
                        {detail.user.firstName} {detail.user.lastName}
                      </h3>
                      <p>ID: #{detail.id.slice(0, 8)}</p>
                      <div className="cp-drawer-tags">
                        <span
                          className={`cp-drawer-tag ${statusMeta(detail.user.status).tone === "green" ? "green" : "gray"}`}
                        >
                          {statusMeta(detail.user.status).label}
                        </span>
                        <span className="cp-drawer-tag gray">
                          <FaLocationDot /> {detail.city || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cp-drawer-quick-stats">
                    <div>
                      <small>Rating</small>
                      <strong>
                        {num(detail.averageRating).toFixed(1)}{" "}
                        <FaStar className="star-yellow" />
                      </strong>
                    </div>
                    <div>
                      <small>Jobs Done</small>
                      <strong>{detail._count?.appointments ?? 0}</strong>
                    </div>
                    <div>
                      <small>Joined</small>
                      <strong>{fmtJoined(detail.createdAt)}</strong>
                    </div>
                  </div>

                  <div className="cp-drawer-section">
                    <h4>Contact Information</h4>
                    <div className="cp-contact-item">
                      <span className="cp-contact-icon">
                        <FaPhone />
                      </span>
                      <div>
                        <small>Phone Number</small>
                        <span>{detail.user.phoneNumber || "Not provided"}</span>
                      </div>
                    </div>
                    <div className="cp-contact-item">
                      <span className="cp-contact-icon">
                        <FaEnvelope />
                      </span>
                      <div>
                        <small>Email Address</small>
                        <span>{detail.user.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="cp-drawer-section">
                    <h4>Recent Services</h4>
                    {serviceNamesFromDetail(detail).length > 0 ? (
                      <div className="cp-service-pills">
                        {serviceNamesFromDetail(detail).map((s, i) => (
                          <span key={s}>
                            <span
                              className={`dot ${SERVICE_DOT_TONES[i % SERVICE_DOT_TONES.length]}`}
                            />
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="cp-muted-note">No recent services recorded.</p>
                    )}
                  </div>

                  <div className="cp-drawer-section">
                    <h4>Recent Activity</h4>
                    {detail.appointments && detail.appointments.length > 0 ? (
                      <div className="cp-timeline">
                        {detail.appointments.slice(0, 4).map((ap) => {
                          const svc =
                            ap.givenService?.service?.translations?.[0]?.name ??
                            ap.givenService?.service?.name ??
                            "Service";
                          const client = ap.client?.user
                            ? `${ap.client.user.firstName ?? ""} ${ap.client.user.lastName ?? ""}`.trim()
                            : "";
                          return (
                            <div className="cp-timeline-item" key={ap.id}>
                              <span className="cp-timeline-dot blue" />
                              <div>
                                <p>{svc}</p>
                                <small>
                                  {ap.status}
                                  {client ? ` • ${client}` : ""}
                                </small>
                                <time>{fmtDate(ap.scheduledDate)}</time>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="cp-muted-note">No recent activity.</p>
                    )}
                  </div>
                </div>
                ) : (
                <div className="cp-drawer-body cp-drawer-body-schedule">
                  <EmployeeScheduleEditor
                    key={detail.id}
                    providerId={detail.id}
                    onSaved={() => showToast("Schedule updated.")}
                  />
                </div>
                )}

                <div className="cp-drawer-footer">
                  <button
                    className="cp-btn-suspend"
                    disabled={removingId === detail.id}
                    onClick={() => setConfirmWithdraw(true)}
                  >
                    {removingId === detail.id ? (
                      <FaSpinner className="cp-spin" />
                    ) : (
                      "Withdraw Provider"
                    )}
                  </button>
                  <button className="cp-btn-primary" onClick={closeDrawer}>
                    Close
                  </button>
                </div>
              </>
            )}
          </aside>
        </>
      ) : null}

      {/* Invitation Details Drawer */}
      {invitationDrawerOpen && selectedInvitation ? (
        <>
          <div
            className="cp-drawer-backdrop"
            onClick={closeInvitationDrawer}
          />
          <aside className="cp-drawer">
            <div className="cp-drawer-header">
              <h2>Invitation Details</h2>
              <div className="cp-drawer-head-actions">
                <button onClick={closeInvitationDrawer} title="Close">
                  <FaXmark />
                </button>
              </div>
            </div>

            <div className="cp-drawer-body">
              {(() => {
                const inv = selectedInvitation;
                const meta = invitationMeta(inv.status);
                const providerName =
                  `${inv.provider.user.firstName} ${inv.provider.user.lastName}`.trim();
                const admin = inv.sentByAdmin?.user;
                const adminName = admin
                  ? `${admin.firstName} ${admin.lastName}`.trim()
                  : "—";
                const reviews = inv.provider.totalReviews ?? 0;

                return (
                  <>
                    <div className="cp-preview-card cp-invitation-preview">
                      {inv.provider.photoUrl ? (
                        <img
                          src={inv.provider.photoUrl}
                          alt={providerName}
                          className="cp-preview-avatar"
                        />
                      ) : (
                        <div className="cp-preview-avatar cp-avatar-fallback">
                          {initialsOf(
                            inv.provider.user.firstName,
                            inv.provider.user.lastName,
                          )}
                        </div>
                      )}
                      <div className="cp-preview-info">
                        <h4>{providerName}</h4>
                        <div className="cp-preview-meta">
                          <span>
                            <FaEnvelope /> {inv.provider.user.email}
                          </span>
                          <span>
                            <FaLocationDot /> {inv.provider.city || "—"}
                          </span>
                          <span>
                            <FaStar className="star-yellow" />{" "}
                            {num(inv.provider.averageRating).toFixed(1)} (
                            {reviews} reviews)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="cp-drawer-tags cp-invitation-status-row">
                      <span className={`cp-status-pill ${meta.tone}`}>
                        <span className={`cp-dot ${meta.tone}`} />
                        {meta.label}
                      </span>
                      <span className="cp-drawer-tag gray">
                        ID #{inv.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="cp-drawer-section">
                      <h4>Invitation</h4>
                      <div className="cp-detail-grid">
                        <div className="cp-detail-item">
                          <small>Sent on</small>
                          <span>{fmtDateTime(inv.createdAt)}</span>
                        </div>
                        <div className="cp-detail-item">
                          <small>Expires on</small>
                          <span>{fmtDateTime(inv.expiresAt)}</span>
                        </div>
                        <div className="cp-detail-item">
                          <small>Responded on</small>
                          <span>
                            {inv.respondedAt
                              ? fmtDateTime(inv.respondedAt)
                              : "Not yet"}
                          </span>
                        </div>
                        {inv.updatedAt ? (
                          <div className="cp-detail-item">
                            <small>Last updated</small>
                            <span>{fmtDateTime(inv.updatedAt)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="cp-drawer-section">
                      <h4>Sent by</h4>
                      <div className="cp-contact-item">
                        <span className="cp-contact-icon">
                          <FaUserTie />
                        </span>
                        <div>
                          <small>Company admin</small>
                          <span>{adminName}</span>
                          {admin?.email ? (
                            <span className="cp-detail-sub">{admin.email}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="cp-drawer-section">
                      <h4>Message</h4>
                      {inv.message?.trim() ? (
                        <p className="cp-invitation-message">{inv.message}</p>
                      ) : (
                        <p className="cp-muted-note">No message was included.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div
              className={`cp-drawer-footer ${selectedInvitation.status !== "PENDING" ? "cp-drawer-footer-single" : ""}`}
            >
              {selectedInvitation.status === "PENDING" ? (
                <button
                  className="cp-btn-suspend"
                  disabled={cancellingId === selectedInvitation.id}
                  onClick={() => setConfirmCancel(selectedInvitation)}
                >
                  {cancellingId === selectedInvitation.id ? (
                    <FaSpinner className="cp-spin" />
                  ) : (
                    "Cancel invitation"
                  )}
                </button>
              ) : null}
              <button
                className="cp-btn-primary"
                onClick={closeInvitationDrawer}
              >
                Close
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Invite Provider Modal */}
      {modalOpen ? (
        <div className="cp-modal-overlay" onClick={closeModal}>
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-header">
              <h3>Invite New Provider</h3>
              <button onClick={closeModal}>
                <FaXmark />
              </button>
            </div>

            {modalStep === 1 ? (
              <>
                <div className="cp-modal-body">
                  <div className="cp-form-group">
                    <label>Provider Email Address</label>
                    <div className="cp-lookup-row">
                      <input
                        type="email"
                        placeholder="john.doe@example.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setLookupError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleLookup();
                        }}
                      />
                      <button
                        className="cp-btn-primary"
                        disabled={lookupLoading}
                        onClick={handleLookup}
                      >
                        {lookupLoading ? (
                          <FaSpinner className="cp-spin" />
                        ) : (
                          "Look up"
                        )}
                      </button>
                    </div>
                    {lookupError ? (
                      <span className="cp-form-error">{lookupError}</span>
                    ) : (
                      <span className="cp-form-hint">
                        We&apos;ll check if this provider has an account.
                      </span>
                    )}
                  </div>
                </div>
                <div className="cp-modal-footer">
                  <button className="cp-btn-ghost" onClick={closeModal}>
                    Cancel
                  </button>
                </div>
              </>
            ) : lookupResult ? (
              <>
                <div className="cp-modal-body">
                  <div className="cp-preview-card">
                    {lookupResult.photoUrl ? (
                      <img
                        src={lookupResult.photoUrl}
                        alt={lookupResult.firstName}
                        className="cp-preview-avatar"
                      />
                    ) : (
                      <div className="cp-preview-avatar cp-avatar-fallback">
                        {initialsOf(
                          lookupResult.firstName,
                          lookupResult.lastName,
                        )}
                      </div>
                    )}
                    <div className="cp-preview-info">
                      <h4>
                        {lookupResult.firstName} {lookupResult.lastName}
                      </h4>
                      <div className="cp-preview-meta">
                        <span>
                          <FaLocationDot /> {lookupResult.city || "—"}
                        </span>
                        <span>
                          <FaStar className="star-yellow" />{" "}
                          {num(lookupResult.averageRating).toFixed(1)} (
                          {lookupResult.totalReviews} reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cp-form-group">
                    <label>Message (optional)</label>
                    <textarea
                      className="cp-textarea"
                      placeholder="Add a short note to your invitation…"
                      maxLength={300}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  {lookupError ? (
                    <span className="cp-form-error">{lookupError}</span>
                  ) : null}
                </div>
                <div className="cp-modal-footer">
                  <button
                    className="cp-btn-ghost"
                    onClick={() => {
                      setModalStep(1);
                      setLookupError(null);
                    }}
                  >
                    Back
                  </button>
                  <button
                    className="cp-btn-primary"
                    disabled={sending}
                    onClick={handleSendInvitation}
                  >
                    {sending ? (
                      <FaSpinner className="cp-spin" />
                    ) : (
                      "Send Invitation"
                    )}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Cancel invitation confirmation */}
      {confirmCancel ? (
        <div
          className="cp-modal-overlay"
          onClick={() => {
            if (!cancellingId) setConfirmCancel(null);
          }}
        >
          <div
            className="cp-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cp-confirm-icon">
              <FaUserClock />
            </div>
            <h3>Cancel invitation?</h3>
            <p>
              The pending invitation to{" "}
              <strong>
                {confirmCancel.provider.user.firstName}{" "}
                {confirmCancel.provider.user.lastName}
              </strong>{" "}
              will be withdrawn and they will be notified.
            </p>
            <div className="cp-confirm-actions">
              <button
                className="cp-btn-ghost"
                disabled={!!cancellingId}
                onClick={() => setConfirmCancel(null)}
              >
                Keep invitation
              </button>
              <button
                className="cp-btn-danger"
                disabled={!!cancellingId}
                onClick={() => handleCancelInvitation(confirmCancel.id)}
              >
                {cancellingId ? (
                  <FaSpinner className="cp-spin" />
                ) : (
                  "Cancel invitation"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Withdraw provider confirmation */}
      {confirmWithdraw && detail ? (
        <div
          className="cp-modal-overlay"
          onClick={() => {
            if (!removingId) setConfirmWithdraw(false);
          }}
        >
          <div
            className="cp-confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cp-confirm-icon">
              <FaUserGroup />
            </div>
            <h3>Withdraw provider?</h3>
            <p>
              <strong>
                {detail.user.firstName} {detail.user.lastName}
              </strong>{" "}
              will be removed from your team and become an independent provider.
              They will be notified of this change.
            </p>
            <div className="cp-confirm-actions">
              <button
                className="cp-btn-ghost"
                disabled={!!removingId}
                onClick={() => setConfirmWithdraw(false)}
              >
                Keep on team
              </button>
              <button
                className="cp-btn-danger"
                disabled={!!removingId}
                onClick={handleRemoveEmployee}
              >
                {removingId ? (
                  <FaSpinner className="cp-spin" />
                ) : (
                  "Withdraw provider"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div className={`cp-toast ${toast.type}`}>
          {toast.type === "success" ? <FaCheck /> : <FaXmark />}
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}
