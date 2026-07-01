import i18n from "../i18n";
import { pickApiStringArray } from "./parseApiStringArray";

type TranslationRow = { locale: string; name: string };

export type IncomingJobRequestData = {
  id: string;
  status: string;
  serviceName: string;
  categoryName: string;
  scheduledDate: string;
  scheduledTime: string;
  price: number;
  pricingType: string;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string | null;
  client: {
    firstName: string;
    lastName: string;
    imageUrl: string | null;
    city: string;
    address: string | null;
  };
};

function pickName(translations: TranslationRow[] | undefined): string {
  if (!translations?.length) return "";
  const preferAr = i18n.language?.startsWith("ar");
  const loc = preferAr ? "AR" : "EN";
  return (
    translations.find((t) => t.locale === loc)?.name ??
    translations.find((t) => t.locale === "EN")?.name ??
    translations[0]?.name ??
    ""
  );
}

function normalizeDateKey(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return "";
}

export function parseIncomingJobRequest(raw: unknown): IncomingJobRequestData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;

  let serviceName = "";
  let categoryName = "";
  let price = 0;
  let pricingType = "FIXED";
  let estimatedDurationMinutes: number | null = null;

  const gs = r.givenService;
  if (gs && typeof gs === "object") {
    const g = gs as Record<string, unknown>;
    if (typeof g.price === "number") price = g.price;
    if (typeof g.pricingType === "string") pricingType = g.pricingType;
    if (g.estimatedDurationMinutes != null) {
      estimatedDurationMinutes = Number(g.estimatedDurationMinutes);
    }
    const svc = g.service;
    if (svc && typeof svc === "object") {
      const s = svc as Record<string, unknown>;
      serviceName = pickName(s.translations as TranslationRow[] | undefined);
      const cat = s.category as Record<string, unknown> | undefined;
      if (cat && typeof cat === "object") {
        categoryName = pickName(cat.translations as TranslationRow[] | undefined);
      }
    }
  }

  let firstName = "";
  let lastName = "";
  let imageUrl: string | null = null;
  let city = "";
  let address: string | null = null;

  const client = r.client;
  if (client && typeof client === "object") {
    const c = client as Record<string, unknown>;
    if (typeof c.city === "string") city = c.city;
    if (typeof c.address === "string") address = c.address;
    if (typeof c.imageUrl === "string") imageUrl = c.imageUrl;
    const user = c.user;
    if (user && typeof user === "object") {
      const u = user as Record<string, unknown>;
      if (typeof u.firstName === "string") firstName = u.firstName;
      if (typeof u.lastName === "string") lastName = u.lastName;
    }
  }

  return {
    id: r.id,
    status: typeof r.status === "string" ? r.status : "UNKNOWN",
    serviceName: serviceName || "Service",
    categoryName: categoryName || "Category",
    scheduledDate: normalizeDateKey(r.scheduledDate),
    scheduledTime: typeof r.scheduledTime === "string" ? r.scheduledTime : "",
    price,
    pricingType,
    estimatedDurationMinutes,
    notes: typeof r.notes === "string" ? r.notes : null,
    latitude: typeof r.latitude === "number" ? r.latitude : null,
    longitude: typeof r.longitude === "number" ? r.longitude : null,
    createdAt:
      typeof r.createdAt === "string"
        ? r.createdAt
        : r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : null,
    client: {
      firstName,
      lastName,
      imageUrl,
      city,
      address,
    },
  };
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateEtaMinutes(distanceKm: number): number {
  const avgKmh = 28;
  return Math.max(1, Math.round((distanceKm / avgKmh) * 60));
}

export function formatJobPrice(price: number, pricingType: string): string {
  const suffix = pricingType === "HOURLY" ? "/hr" : "";
  return `${price} TND${suffix}`;
}

export function clientDisplayName(first: string, last: string): string {
  const full = `${first} ${last}`.trim();
  return full || "Client";
}

export function clientInitials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  if (a && b) return `${a}${b}`;
  return (a || b || "?").slice(0, 2);
}

export const INCOMING_REQUEST_TIMEOUT_SEC = 60;

export const DECLINE_REASON_KEYS = [
  "distance",
  "busy",
  "skill",
  "pay",
  "timeout",
] as const;

export type DeclineReasonKey = (typeof DECLINE_REASON_KEYS)[number];

export function appointmentPhotoUrls(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  return pickApiStringArray(raw as Record<string, unknown>, "photoUrls", "photo_urls");
}
