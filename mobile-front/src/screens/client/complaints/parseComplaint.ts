import type {
  ComplaintCategory,
  ComplaintDecision,
  ComplaintStatus,
  ClientComplaintRow,
} from "../../../services/api";

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

function parseAppointment(
  raw: unknown,
): ClientComplaintRow["appointment"] | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const scheduledDate =
    typeof a.scheduledDate === "string" ? a.scheduledDate : null;
  const scheduledTime =
    typeof a.scheduledTime === "string" ? a.scheduledTime : null;
  if (!scheduledDate || !scheduledTime) return null;
  return { scheduledDate, scheduledTime };
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
  const createdAt =
    typeof r.createdAt === "string"
      ? r.createdAt
      : typeof r.createdAt === "object" && r.createdAt !== null
        ? String(r.createdAt)
        : "";
  const resolvedAt =
    typeof r.resolvedAt === "string"
      ? r.resolvedAt
      : r.resolvedAt === null
        ? null
        : typeof r.resolvedAt === "object" && r.resolvedAt !== null
          ? String(r.resolvedAt)
          : null;

  const appointment = parseAppointment(r.appointment);
  const provider = parseProvider(r.provider);
  if (!appointment || !provider) return null;

  return {
    id,
    category: cat as ComplaintCategory,
    status: st as ComplaintStatus,
    description,
    evidenceUrls,
    adminResponse,
    decision,
    createdAt,
    resolvedAt,
    appointment,
    provider,
  };
}
