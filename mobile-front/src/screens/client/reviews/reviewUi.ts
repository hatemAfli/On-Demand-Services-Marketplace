import type { ClientReviewListItem } from "../../../services/api";

export function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatBookingLine(
  scheduledDate: string,
  scheduledTime: string,
): string {
  try {
    const [y, m, d] = scheduledDate.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const day = dt.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${day} · ${scheduledTime}`;
  } catch {
    return `${scheduledDate} · ${scheduledTime}`;
  }
}

export function parseClientReviewRow(raw: unknown): ClientReviewListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  return {
    id: r.id,
    appointmentId: String(r.appointmentId ?? ""),
    providerId: String(r.providerId ?? ""),
    givenServiceId: String(r.givenServiceId ?? ""),
    rating: typeof r.rating === "number" ? r.rating : Number(r.rating) || 0,
    comment:
      typeof r.comment === "string" ? r.comment : r.comment == null ? null : null,
    providerReply:
      typeof r.providerReply === "string"
        ? r.providerReply
        : r.providerReply == null
          ? null
          : null,
    repliedAt:
      typeof r.repliedAt === "string" ? r.repliedAt : r.repliedAt == null ? null : null,
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
    providerName: String(r.providerName ?? "Provider"),
    providerPhotoUrl:
      typeof r.providerPhotoUrl === "string"
        ? r.providerPhotoUrl
        : r.providerPhotoUrl == null
          ? null
          : null,
    serviceName: String(r.serviceName ?? "Service"),
    scheduledDate: String(r.scheduledDate ?? "").slice(0, 10),
    scheduledTime: String(r.scheduledTime ?? ""),
  };
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
