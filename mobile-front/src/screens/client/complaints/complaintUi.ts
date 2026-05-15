import { COLORS } from "../../../constants";
import type { ComplaintStatus } from "../../../services/api";

export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatBookingDateTime(
  scheduledDate: string,
  scheduledTime: string,
): string {
  try {
    const d = parseYmdLocal(scheduledDate);
    const day = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${scheduledTime}`;
  } catch {
    return `${scheduledDate} · ${scheduledTime}`;
  }
}

export function statusBarColor(status: ComplaintStatus): string {
  switch (status) {
    case "OPEN":
      return COLORS.warning;
    case "UNDER_REVIEW":
      return COLORS.info;
    case "RESOLVED":
      return COLORS.success;
    case "DISMISSED":
    case "WITHDRAWN":
    default:
      return COLORS.gray[400];
  }
}

export function statusPillStyle(status: ComplaintStatus): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "OPEN":
      return { bg: "#FEF3C7", text: "#B45309" };
    case "UNDER_REVIEW":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "RESOLVED":
      return { bg: "#D1FAE5", text: "#047857" };
    case "DISMISSED":
    case "WITHDRAWN":
    default:
      return { bg: COLORS.gray[100], text: COLORS.gray[600] };
  }
}
