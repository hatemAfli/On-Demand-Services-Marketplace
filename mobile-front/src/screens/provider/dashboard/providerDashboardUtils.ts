import type { AppointmentStatus } from "../../../services/api";

export function formatRating(value: unknown): string {
  const rating = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return "0.0";
  return rating.toFixed(1);
}

export function statusAccent(status: AppointmentStatus): string {
  switch (status) {
    case "PENDING":
      return "#F59E0B";
    case "CONFIRMED":
    case "RESCHEDULED":
      return "#3B82F6";
    case "EN_ROUTE":
      return "#8B5CF6";
    case "IN_PROGRESS":
      return "#10B981";
    case "COMPLETED":
      return "#059669";
    default:
      return "#94A3B8";
  }
}
