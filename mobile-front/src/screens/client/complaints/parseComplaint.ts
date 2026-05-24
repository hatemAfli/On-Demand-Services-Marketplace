import type {
  AppointmentStatus,
  ComplaintCategory,
  ComplaintDecision,
  ComplaintStatus,
  ClientComplaintRow,
} from "../../../services/api";
import i18n from "../../../i18n";

const CATEGORIES = new Set<string>([
  "SERVICE_QUALITY",
  "NO_SHOW",
  "LATE_ARRIVAL",
  "UNPROFESSIONAL",
  "OVERCHARGING",
  "PROPERTY_DAMAGE",
  "SAFETY_CONCERN",
  "FRAUD",
  "OTHER",
]);

const STATUSES = new Set<string>([
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
  "WITHDRAWN",
]);

const DECISIONS = new Set<string>([
  "WARNING_ISSUED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_BANNED",
  "REFUND_ISSUED",
  "NO_ACTION",
  "FORWARDED_TO_COMPANY",
]);

const APPOINTMENT_STATUSES = new Set<string>([
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED_CLIENT",
  "CANCELLED_PROVIDER",
  "REFUSED",
  "DISPUTED",
]);

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

function parseProvider(raw: unknown): ClientComplaintRow["provider"] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const photoUrl =
    typeof o.photoUrl === "string"
      ? o.photoUrl
      : o.photoUrl === null
        ? null
        : null;
  const user = o.user as Record<string, unknown> | undefined;
  if (
    user &&
    typeof user.firstName === "string" &&
    typeof user.lastName === "string"
  ) {
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl,
    };
  }
  if (typeof o.firstName === "string" && typeof o.lastName === "string") {
    return { firstName: o.firstName, lastName: o.lastName, photoUrl };
  }
  return null;
}

function parseIsoDate(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "object" && raw !== null) return String(raw);
  return null;
}

function parseAppointment(
  raw: unknown,
  fallbackAppointmentId: string,
): ClientComplaintRow["appointment"] | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const scheduledDate =
    typeof a.scheduledDate === "string"
      ? a.scheduledDate
      : a.scheduledDate instanceof Date
        ? a.scheduledDate.toISOString().slice(0, 10)
        : null;
  const scheduledTime =
    typeof a.scheduledTime === "string" ? a.scheduledTime : null;
  if (!scheduledDate || !scheduledTime) return null;

  const id =
    typeof a.id === "string" && a.id.length > 0
      ? a.id
      : fallbackAppointmentId;

  const statusRaw = typeof a.status === "string" ? a.status : null;
  const status =
    statusRaw && APPOINTMENT_STATUSES.has(statusRaw)
      ? (statusRaw as AppointmentStatus)
      : undefined;

  const notes =
    typeof a.notes === "string"
      ? a.notes
      : a.notes === null
        ? null
        : undefined;

  let serviceName: string | undefined;
  let categoryName: string | undefined;
  const gs = a.givenService as Record<string, unknown> | undefined;
  const service = gs?.service as
    | {
        translations?: { locale: string; name: string }[];
        category?: { translations?: { locale: string; name: string }[] };
      }
    | undefined;
  if (service) {
    const sn = pickLocaleName(service.translations);
    if (sn) serviceName = sn;
    const cn = pickLocaleName(service.category?.translations);
    if (cn) categoryName = cn;
  }

  return {
    id,
    scheduledDate,
    scheduledTime,
    status,
    serviceName,
    categoryName,
    notes,
  };
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** Normalizes GET /complaints/me and GET /complaints/:id payloads for the client UI. */
export function parseClientComplaintRow(raw: unknown): ClientComplaintRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  const appointmentId =
    typeof r.appointmentId === "string" ? r.appointmentId : "";
  const cat = typeof r.category === "string" ? r.category : "";
  if (!CATEGORIES.has(cat)) return null;
  const st = typeof r.status === "string" ? r.status : "";
  if (!STATUSES.has(st)) return null;
  const description =
    typeof r.description === "string" ? r.description : "";
  const evidenceUrls = parseStringArray(r.evidenceUrls);
  const adminResponse =
    typeof r.adminResponse === "string"
      ? r.adminResponse
      : r.adminResponse === null
        ? null
        : null;
  const decisionRaw = r.decision;
  const decision =
    decisionRaw === null || decisionRaw === undefined
      ? null
      : typeof decisionRaw === "string" && DECISIONS.has(decisionRaw)
        ? (decisionRaw as ComplaintDecision)
        : null;
  const createdAt = parseIsoDate(r.createdAt) ?? "";
  const reviewedAt = parseIsoDate(r.reviewedAt);
  const resolvedAt = parseIsoDate(r.resolvedAt);

  const appointment = parseAppointment(r.appointment, appointmentId);
  const provider = parseProvider(r.provider);
  if (!appointment || !provider) return null;

  return {
    id,
    appointmentId: appointment.id || appointmentId,
    category: cat as ComplaintCategory,
    status: st as ComplaintStatus,
    description,
    evidenceUrls,
    adminResponse,
    decision,
    createdAt,
    reviewedAt,
    resolvedAt,
    appointment,
    provider,
  };
}
