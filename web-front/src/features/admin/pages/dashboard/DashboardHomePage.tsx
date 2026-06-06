import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Flag,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  StatsCard,
  StatusBadge,
  UserMiniCard,
} from "../../../../components/admin";
import { adminApi } from "../../../../services/adminApi";
import { api } from "../../../../services/api";
import { useAuthStore } from "../../../../stores/authStore";
import type {
  AdminAppointment,
  AdminComplaint,
  AppointmentStats,
  ComplaintStats,
  ReviewStats,
} from "../../../../types/admin";
import type { AdminOutletContext } from "../../layout/adminOutletContext";
import { RatingDistribution } from "../reviews/RatingDistribution";
import {
  formatApiMessage,
  formatPersonName,
  formatRelativeTime,
  formatScheduled,
  pickServiceName,
} from "./dashboardUtils";
import "./DashboardHomePage.css";

type DashboardData = {
  appointmentStats: AppointmentStats;
  complaintStats: ComplaintStats;
  reviewStats: ReviewStats;
  totalUsers: number;
  totalCompanies: number;
  newSupportMessages: number;
  recentAppointments: AdminAppointment[];
  recentComplaints: AdminComplaint[];
};

const ACTIVE_APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "RESCHEDULED",
  "EN_ROUTE",
  "IN_PROGRESS",
] as const;

const CHART_STATUSES = [
  { key: "PENDING", label: "Pending", color: "#f59e0b" },
  { key: "CONFIRMED", label: "Confirmed", color: "#3b82f6" },
  { key: "IN_PROGRESS", label: "In progress", color: "#6366f1" },
  { key: "COMPLETED", label: "Completed", color: "#16a34a" },
  { key: "DISPUTED", label: "Disputed", color: "#ef4444" },
] as const;

export function DashboardHomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const queue = useOutletContext<AdminOutletContext>();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = user?.firstName?.trim()
    ? `Welcome back, ${user.firstName}`
    : "Welcome back";

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [appointmentStatsRes, complaintStatsRes, reviewStatsRes] =
        await Promise.all([
          adminApi.getAppointmentStats(),
          adminApi.getComplaintStats(),
          adminApi.getReviewStats(),
        ]);

      const [
        usersRes,
        companiesRes,
        supportRes,
        recentAppointmentsRes,
        recentComplaintsRes,
      ] = await Promise.all([
        api.listAdminUsers({ take: 1, skip: 0 }),
        api.listAdminCompanies({ take: 1, skip: 0 }),
        api.getAdminSupportMessageStats(),
        adminApi.getAdminAppointments({ take: 6, sort: "recent" }),
        adminApi.getAdminComplaints({ take: 6, sort: "recent" }),
      ]);

      setData({
        appointmentStats: appointmentStatsRes.data,
        complaintStats: complaintStatsRes.data,
        reviewStats: reviewStatsRes.data,
        totalUsers: usersRes.data.total,
        totalCompanies: companiesRes.data.total,
        newSupportMessages: supportRes.data.newCount,
        recentAppointments: recentAppointmentsRes.data.items,
        recentComplaints: recentComplaintsRes.data.items,
      });
    } catch (err) {
      setError(formatApiMessage(err));
      if (!silent) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const activeAppointments = useMemo(() => {
    if (!data) return 0;
    return ACTIVE_APPOINTMENT_STATUSES.reduce(
      (sum, status) => sum + (data.appointmentStats.byStatus[status] ?? 0),
      0,
    );
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return CHART_STATUSES.map(({ key, label, color }) => ({
      name: label,
      count: data.appointmentStats.byStatus[key] ?? 0,
      fill: color,
    }));
  }, [data]);

  const statusBreakdown = useMemo(() => {
    if (!data) return [];
    const total = data.appointmentStats.total || 1;
    return Object.entries(data.appointmentStats.byStatus)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([status, count]) => ({
        status,
        count,
        pct: Math.round((count / total) * 100),
      }));
  }, [data]);

  const primaryAlert = useMemo(() => {
    if (!data) return null;
    if (queue.pendingVerificationTotal > 0) {
      return {
        tone: "warn" as const,
        title: `${queue.pendingVerificationTotal} profile${queue.pendingVerificationTotal === 1 ? "" : "s"} awaiting validation`,
        message: "Review pending provider and company verification requests.",
        path: "/admin/validations/pending-providers",
      };
    }
    if (data.complaintStats.open > 0) {
      return {
        tone: "danger" as const,
        title: `${data.complaintStats.open} open reclamation${data.complaintStats.open === 1 ? "" : "s"}`,
        message: "Clients are waiting for a response on active complaints.",
        path: "/admin/reclamations",
      };
    }
    if (data.appointmentStats.disputedActive > 0) {
      return {
        tone: "danger" as const,
        title: `${data.appointmentStats.disputedActive} disputed appointment${data.appointmentStats.disputedActive === 1 ? "" : "s"}`,
        message: "Review appointments flagged for platform intervention.",
        path: "/admin/appointments/list",
      };
    }
    if (data.newSupportMessages > 0) {
      return {
        tone: "warn" as const,
        title: `${data.newSupportMessages} new support message${data.newSupportMessages === 1 ? "" : "s"}`,
        message: "Unread messages from users need attention.",
        path: "/admin/messages",
      };
    }
    return null;
  }, [data, queue.pendingVerificationTotal]);

  if (loading && !data) {
    return (
      <div className="admin-dashboard">
        <div className="admin-dashboard__loading">Loading dashboard…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="admin-dashboard">
        <div className="admin-dashboard__error">
          <p>{error}</p>
          <button type="button" onClick={() => void load(false)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__header">
        <div>
          <h1>{greeting}</h1>
          <p>Platform overview · {dayjs().format("dddd, D MMMM YYYY")}</p>
        </div>
        <button
          type="button"
          className="admin-dashboard__refresh"
          onClick={() => void load(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {primaryAlert ? (
        <button
          type="button"
          className={`admin-dashboard__alert${primaryAlert.tone === "danger" ? " admin-dashboard__alert--danger" : ""}`}
          onClick={() => navigate(primaryAlert.path)}
        >
          <AlertTriangle size={20} className="admin-dashboard__alert-icon" />
          <div className="admin-dashboard__alert-body">
            <strong>{primaryAlert.title}</strong>
            <span>{primaryAlert.message}</span>
          </div>
          <span className="admin-dashboard__alert-arrow">→</span>
        </button>
      ) : null}

      <section className="admin-stats-grid admin-dashboard__stats">
        <StatsCard
          title="Pending validations"
          value={queue.pendingVerificationTotal}
          subtitle={`${queue.pendingProviderVerifications} providers · ${queue.pendingCompanyVerifications} companies`}
          icon={ShieldCheck}
          color="#6366f1"
        />
        <StatsCard
          title="Open reclamations"
          value={data.complaintStats.open}
          subtitle={`${data.complaintStats.underReview} under review`}
          icon={Flag}
          color="#ef4444"
        />
        <StatsCard
          title="Active appointments"
          value={activeAppointments}
          subtitle={`${data.appointmentStats.total} total on platform`}
          icon={CalendarClock}
          color="#3b82f6"
        />
        <StatsCard
          title="Completed today"
          value={data.appointmentStats.completedToday}
          subtitle={
            data.appointmentStats.averageDurationMinutes > 0
              ? `Avg. ${data.appointmentStats.averageDurationMinutes} min`
              : undefined
          }
          icon={CheckCircle2}
          color="#16a34a"
        />
        <StatsCard
          title="Platform users"
          value={data.totalUsers}
          subtitle={`${data.totalCompanies} registered companies`}
          icon={Users}
          color="#8b5cf6"
        />
        <StatsCard
          title="Average rating"
          value={data.reviewStats.averageRating.toFixed(1)}
          subtitle={`${data.reviewStats.total} reviews · ${data.reviewStats.hidden} hidden`}
          icon={Star}
          color="#f59e0b"
        />
        <StatsCard
          title="Disputed orders"
          value={data.appointmentStats.disputedActive}
          subtitle="Needs intervention"
          icon={AlertTriangle}
          color="#dc2626"
        />
        <StatsCard
          title="New support messages"
          value={data.newSupportMessages}
          subtitle="Unread inbox"
          icon={MessageSquare}
          color="#0ea5e9"
        />
      </section>

      <section className="admin-dashboard__quick-actions">
        <button
          type="button"
          className="admin-dashboard__action"
          onClick={() => navigate("/admin/validations/pending-providers")}
        >
          <span
            className="admin-dashboard__action-icon"
            style={{ background: "#eef2ff", color: "#6366f1" }}
          >
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>Validation Center</strong>
            <span>{queue.pendingVerificationTotal} pending</span>
          </div>
        </button>
        <button
          type="button"
          className="admin-dashboard__action"
          onClick={() => navigate("/admin/reclamations")}
        >
          <span
            className="admin-dashboard__action-icon"
            style={{ background: "#fef2f2", color: "#ef4444" }}
          >
            <Flag size={18} />
          </span>
          <div>
            <strong>Reclamations</strong>
            <span>{data.complaintStats.open} open</span>
          </div>
        </button>
        <button
          type="button"
          className="admin-dashboard__action"
          onClick={() => navigate("/admin/appointments/list")}
        >
          <span
            className="admin-dashboard__action-icon"
            style={{ background: "#eff6ff", color: "#3b82f6" }}
          >
            <CalendarClock size={18} />
          </span>
          <div>
            <strong>Appointments</strong>
            <span>{data.appointmentStats.total} total</span>
          </div>
        </button>
        <button
          type="button"
          className="admin-dashboard__action"
          onClick={() => navigate("/admin/companies")}
        >
          <span
            className="admin-dashboard__action-icon"
            style={{ background: "#f5f3ff", color: "#8b5cf6" }}
          >
            <Building2 size={18} />
          </span>
          <div>
            <strong>Companies</strong>
            <span>{data.totalCompanies} registered</span>
          </div>
        </button>
      </section>

      <div className="admin-dashboard__grid">
        <section className="admin-dashboard__panel">
          <div className="admin-dashboard__panel-head">
            <h2>Appointments by status</h2>
            <button
              type="button"
              className="admin-dashboard__panel-link"
              onClick={() => navigate("/admin/appointments/list")}
            >
              View all
            </button>
          </div>
          <div className="admin-dashboard__chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#8c8c8c" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#8c8c8c" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#fafafa" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #f0f0f0",
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div
            className="admin-dashboard__status-list"
            style={{ marginTop: 16 }}
          >
            {statusBreakdown.map((row) => (
              <div key={row.status} className="admin-dashboard__status-row">
                <span className="admin-dashboard__status-label">
                  {row.status.replace(/_/g, " ")}
                </span>
                <div className="admin-dashboard__status-track">
                  <div
                    className="admin-dashboard__status-bar"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="admin-dashboard__status-count">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-dashboard__panel">
          <div className="admin-dashboard__panel-head">
            <h2>Review quality</h2>
            <button
              type="button"
              className="admin-dashboard__panel-link"
              onClick={() => navigate("/admin/reviews")}
            >
              Manage reviews
            </button>
          </div>
          <div className="admin-dashboard__review-summary">
            <strong>{data.reviewStats.averageRating.toFixed(2)}</strong>
            <span>
              public average · {data.reviewStats.withReply} with provider reply
            </span>
          </div>
          <RatingDistribution
            byRating={data.reviewStats.byRating}
            total={data.reviewStats.total}
          />
        </section>
      </div>

      <div className="admin-dashboard__tables">
        <section className="admin-dashboard__panel">
          <div className="admin-dashboard__panel-head">
            <h2>Recent appointments</h2>
            <button
              type="button"
              className="admin-dashboard__panel-link"
              onClick={() => navigate("/admin/appointments/list")}
            >
              View all
            </button>
          </div>
          <div className="admin-data-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="admin-data-table__empty">
                      No appointments yet
                    </td>
                  </tr>
                ) : (
                  data.recentAppointments.map((row) => (
                    <tr
                      key={row.id}
                      className="admin-data-table__row--clickable"
                      onClick={() => navigate(`/admin/appointments/${row.id}`)}
                    >
                      <td>
                        <UserMiniCard
                          name={formatPersonName(
                            row.client.user.firstName,
                            row.client.user.lastName,
                          )}
                          email={row.client.user.email}
                          photo={row.client.imageUrl}
                        />
                      </td>
                      <td>
                        {pickServiceName(
                          row.givenService?.service?.translations ?? [],
                        )}
                        <div
                          className="admin-muted"
                          style={{ fontSize: 12, marginTop: 2 }}
                        >
                          {formatScheduled(
                            row.scheduledDate,
                            row.scheduledTime,
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge type="appointment" status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-dashboard__panel">
          <div className="admin-dashboard__panel-head">
            <h2>Recent reclamations</h2>
            <button
              type="button"
              className="admin-dashboard__panel-link"
              onClick={() => navigate("/admin/reclamations")}
            >
              View all
            </button>
          </div>
          <div className="admin-data-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Provider</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="admin-data-table__empty">
                      No reclamations yet
                    </td>
                  </tr>
                ) : (
                  data.recentComplaints.map((row) => (
                    <tr
                      key={row.id}
                      className="admin-data-table__row--clickable"
                      onClick={() => navigate(`/admin/reclamations/${row.id}`)}
                    >
                      <td>
                        <UserMiniCard
                          name={formatPersonName(
                            row.client.user.firstName,
                            row.client.user.lastName,
                          )}
                          email={row.client.user.email}
                          photo={row.client.imageUrl}
                        />
                        <div
                          className="admin-muted"
                          style={{ fontSize: 12, marginTop: 4 }}
                        >
                          {formatRelativeTime(row.createdAt)}
                        </div>
                      </td>
                      <td>
                        <UserMiniCard
                          name={formatPersonName(
                            row.provider.user.firstName,
                            row.provider.user.lastName,
                          )}
                          city={row.provider.city}
                          photo={row.provider.photoUrl}
                        />
                      </td>
                      <td>
                        <StatusBadge type="complaint" status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
