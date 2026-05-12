import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FontAwesome5 as Icon } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import i18n from "../../../i18n";
import {
  api,
  type AppointmentStatus,
} from "../../../services/api";
import { styles } from "./styles";

type ClientHomeHighlight = {
  id: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number | null;
  startedAt: string | null;
  givenService: { serviceName: string; categoryName: string };
  provider: { firstName: string; lastName: string };
};

type Props = {
  onOpenAppointment: (appointmentId: string) => void;
  refreshSignal?: number;
};

function pickLocaleName(
  translations: { locale: string; name: string }[] | undefined,
): string {
  if (!translations?.length) return "";
  const want = i18n.language?.startsWith("ar") ? "AR" : "EN";
  return (
    translations.find((t) => t.locale === want)?.name ??
    translations[0]?.name ??
    ""
  );
}

function toYmd(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return null;
  }
  const d = value as Date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeClientHomeAppointment(
  raw: unknown,
): ClientHomeHighlight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string") return null;

  const gs = r.givenService as Record<string, unknown> | undefined;
  const service = gs?.service as
    | {
        translations?: { locale: string; name: string }[];
        category?: { translations?: { locale: string; name: string }[] };
      }
    | undefined;
  const prov = r.provider as
    | { user?: { firstName?: string | null; lastName?: string | null } }
    | undefined;

  return {
    id,
    status: r.status as AppointmentStatus,
    scheduledDate: toYmd(r.scheduledDate as string) ?? "",
    scheduledTime: String(r.scheduledTime ?? ""),
    durationMinutes:
      typeof r.durationMinutes === "number" ? r.durationMinutes : null,
    startedAt:
      r.startedAt != null && r.startedAt !== ""
        ? String(r.startedAt)
        : null,
    givenService: {
      serviceName: pickLocaleName(service?.translations),
      categoryName: pickLocaleName(service?.category?.translations),
    },
    provider: {
      firstName: prov?.user?.firstName?.trim() ?? "",
      lastName: prov?.user?.lastName?.trim() ?? "",
    },
  };
}

function combineLocalDateTime(dateYmd: string, timeHm: string): Date {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const parts = timeHm.split(":");
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return new Date(y, (mo || 1) - 1, d || 1, hh, mm, 0, 0);
}

function slotDurationMinutes(duration: number | null): number {
  return duration && duration > 0 ? duration : 60;
}

function slotEndDate(a: ClientHomeHighlight): Date {
  const start = combineLocalDateTime(a.scheduledDate, a.scheduledTime);
  return new Date(
    start.getTime() + slotDurationMinutes(a.durationMinutes) * 60 * 1000,
  );
}

function parseIsoDate(d: string | null): Date | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

function sortByScheduleAsc(
  a: ClientHomeHighlight,
  b: ClientHomeHighlight,
): number {
  const da = combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime();
  const db = combineLocalDateTime(b.scheduledDate, b.scheduledTime).getTime();
  return da - db;
}

const HIGHLIGHT_EXCLUDED: AppointmentStatus[] = [
  "CANCELLED_CLIENT",
  "CANCELLED_PROVIDER",
  "REFUSED",
  "COMPLETED",
  "DISPUTED",
];

function isHighlightCandidate(a: ClientHomeHighlight): boolean {
  return !HIGHLIGHT_EXCLUDED.includes(a.status);
}

function pickClientHomeHighlight(
  rows: ClientHomeHighlight[],
  now: Date,
): ClientHomeHighlight | null {
  const candidates = rows.filter(isHighlightCandidate);
  if (!candidates.length) return null;
  const sorted = [...candidates].sort(sortByScheduleAsc);

  const inProgress = sorted.filter((a) => a.status === "IN_PROGRESS");
  if (inProgress.length) return inProgress[0];

  const enRoute = sorted.filter((a) => a.status === "EN_ROUTE");
  const enRouteOk = enRoute.filter(
    (a) => now.getTime() <= slotEndDate(a).getTime(),
  );
  if (enRouteOk.length) return enRouteOk[0];

  const confirmed = sorted.filter((a) => a.status === "CONFIRMED");
  const windows = confirmed.map((a) => ({
    a,
    start: combineLocalDateTime(a.scheduledDate, a.scheduledTime),
    end: slotEndDate(a),
  }));
  const inside = windows.find(
    ({ start, end }) => now >= start && now < end,
  );
  if (inside) return inside.a;

  const nowMs = now.getTime();
  const upcoming = sorted.filter((a) =>
    ["CONFIRMED", "PENDING", "RESCHEDULED", "EN_ROUTE"].includes(a.status),
  );
  const next = upcoming.find(
    (a) =>
      combineLocalDateTime(a.scheduledDate, a.scheduledTime).getTime() > nowMs,
  );
  if (next) return next;

  return null;
}

function statusMeta(status: AppointmentStatus): {
  label: string;
  dot: string;
  sub: string;
} {
  switch (status) {
    case "IN_PROGRESS":
      return {
        label: "In progress",
        dot: "#4F46E5",
        sub: "Service in progress",
      };
    case "EN_ROUTE":
      return {
        label: "On the way",
        dot: "#9333EA",
        sub: "Provider is heading to you",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        dot: "#3B82F6",
        sub: "Upcoming visit",
      };
    case "PENDING":
      return {
        label: "Pending",
        dot: "#F59E0B",
        sub: "Awaiting provider response",
      };
    case "RESCHEDULED":
      return {
        label: "Rescheduled",
        dot: "#EA580C",
        sub: "New time proposed",
      };
    default:
      return {
        label: "Booking",
        dot: "#6B7280",
        sub: "Your appointment",
      };
  }
}

function formatShortDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export const ActiveOrderCard: React.FC<Props> = ({
  onOpenAppointment,
  refreshSignal = 0,
}) => {
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState<ClientHomeHighlight | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMyAppointmentsAsClient();
      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped = rows
        .map((row) => normalizeClientHomeAppointment(row))
        .filter((x): x is ClientHomeHighlight => x !== null);
      setHighlight(pickClientHomeHighlight(mapped, new Date()));
    } catch {
      setHighlight(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load]),
  );

  useEffect(() => {
    if (refreshSignal > 0) void load();
  }, [refreshSignal, load]);

  useEffect(() => {
    if (highlight?.status !== "IN_PROGRESS") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [highlight?.status, highlight?.id]);

  const progressPct = useMemo(() => {
    if (!highlight || highlight.status !== "IN_PROGRESS") return 12;
    const start =
      parseIsoDate(highlight.startedAt) ??
      combineLocalDateTime(highlight.scheduledDate, highlight.scheduledTime);
    const durMs = slotDurationMinutes(highlight.durationMinutes) * 60 * 1000;
    const elapsed = Math.max(0, Date.now() - start.getTime());
    const totalSec = Math.max(60, Math.floor(durMs / 1000));
    const elapsedSec = Math.floor(elapsed / 1000);
    return Math.min(100, (elapsedSec / totalSec) * 100);
  }, [highlight, tick]);

  if (loading) {
    return (
      <View style={styles.activeOrderContainer}>
        <View style={[styles.activeOrderCard, localStyles.loadingCard]}>
          <ActivityIndicator color="#4F46E5" />
          <Text style={localStyles.loadingText}>Loading your booking…</Text>
        </View>
      </View>
    );
  }

  if (!highlight) {
    return (
      <View style={styles.activeOrderContainer}>
        <View style={[styles.activeOrderCard, localStyles.emptyCard]}>
          <Text style={localStyles.emptyTitle}>No active booking</Text>
          <Text style={localStyles.emptySub}>
            Confirmed and in-progress visits will show here.
          </Text>
        </View>
      </View>
    );
  }

  const meta = statusMeta(highlight.status);
  const providerName =
    `${highlight.provider.firstName} ${highlight.provider.lastName}`.trim() ||
    "Provider";
  const serviceTitle =
    highlight.givenService.serviceName || "Service";
  const shortId = highlight.id.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <View style={styles.activeOrderContainer}>
      <Pressable
        onPress={() => onOpenAppointment(highlight.id)}
        style={({ pressed }) => [
          styles.activeOrderCard,
          pressed && localStyles.cardPressed,
        ]}
      >
        <View style={styles.cardPattern} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.orderIconContainer}>
                <Icon name="calendar-check" size={18} color="#fff" />
              </View>
              <View style={localStyles.titleBlock}>
                <Text style={styles.orderId} numberOfLines={1}>
                  {serviceTitle}
                </Text>
                <View style={styles.orderStatus}>
                  <View
                    style={[
                      styles.statusIndicator,
                      { backgroundColor: meta.dot },
                    ]}
                  />
                  <Text
                    style={[styles.statusText, { color: meta.dot }]}
                    numberOfLines={1}
                  >
                    {meta.label} · {highlight.scheduledTime}
                  </Text>
                </View>
              </View>
            </View>
            <View style={localStyles.chevronWrap}>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </View>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(6, progressPct)}%` },
              ]}
            />
          </View>
          <View style={styles.orderDetails}>
            <Text style={styles.orderItems} numberOfLines={2}>
              {providerName} · {formatShortDate(highlight.scheduledDate)} · #
              {shortId}
            </Text>
            <Text style={styles.orderPrice} numberOfLines={1}>
              {highlight.givenService.categoryName || meta.sub}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const localStyles = StyleSheet.create({
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
  },
  emptyCard: {
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  chevronWrap: { paddingLeft: 8, paddingTop: 4 },
  cardPressed: { opacity: 0.92 },
});
