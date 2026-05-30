// src/services/api.ts

import axios, { AxiosInstance, AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { CONFIG } from "../constants";
import type { UserRole } from "../types";
import i18n from "../i18n";
import { supabase } from "./supabase";

type FavoriteType = "CATEGORY" | "SERVICE" | "PROVIDER";

export type ProviderAvailabilityDayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type ProviderAvailabilityDay = {
  id?: string;
  providerId?: string;
  dayOfWeek: ProviderAvailabilityDayOfWeek;
  isWorking: boolean;
  startTime: string;
  endTime: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UpsertProviderAvailabilityPayload = {
  days: Array<{
    dayOfWeek: ProviderAvailabilityDayOfWeek;
    isWorking: boolean;
    startTime: string;
    endTime: string;
  }>;
};

export type ProviderDayOffItem = {
  id: string;
  providerId?: string;
  date: string;
  reason?: string | null;
  createdAt?: string;
};

/** Matches Prisma `AppointmentStatus`. */
export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REFUSED"
  | "RESCHEDULED"
  | "CANCELLED_CLIENT"
  | "CANCELLED_PROVIDER"
  | "EN_ROUTE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DISPUTED";

/** Matches Prisma `ComplaintCategory`. */
export type ComplaintCategory =
  | "SERVICE_QUALITY"
  | "NO_SHOW"
  | "LATE_ARRIVAL"
  | "UNPROFESSIONAL"
  | "OVERCHARGING"
  | "PROPERTY_DAMAGE"
  | "SAFETY_CONCERN"
  | "FRAUD"
  | "OTHER";

/** Matches Prisma `ComplaintStatus`. */
export type ComplaintStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "DISMISSED"
  | "WITHDRAWN";

/** Matches Prisma `ComplaintDecision`. */
export type ComplaintDecision =
  | "WARNING_ISSUED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_BANNED"
  | "REFUND_ISSUED"
  | "NO_ACTION"
  | "FORWARDED_TO_COMPANY";

/** Row from admin GET `/complaints` (after backend list mapping). */
export type AdminComplaintListItem = {
  id: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  description: string;
  targetIsEmployee: boolean;
  createdAt: string;
  client: {
    imageUrl: string | null;
    user: { firstName: string; lastName: string };
  };
  provider: {
    photoUrl: string | null;
    user: { firstName: string; lastName: string };
  };
  appointment: {
    id: string;
    scheduledDate: string;
    scheduledTime: string;
    serviceName: string;
  };
};

export type AdminComplaintsListResponse = {
  items: AdminComplaintListItem[];
  total: number;
};

/** Provider-facing complaint row (no client PII). */
export type ProviderComplaintSummaryItem = {
  id: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  decision: ComplaintDecision | null;
  adminResponse: string | null;
  createdAt: string;
  appointment: {
    scheduledDate: string;
    scheduledTime: string;
    serviceName: string;
  };
};

export type ProviderComplaintsSummaryResponse = {
  totalComplaints: number;
  activeComplaints: number;
  items: ProviderComplaintSummaryItem[];
};

/** Normalized complaint row for client list/detail (after parsing API JSON). */
export type ClientComplaintRow = {
  id: string;
  appointmentId: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  description: string;
  evidenceUrls: string[];
  adminResponse: string | null;
  decision: ComplaintDecision | null;
  createdAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
  appointment: {
    id: string;
    scheduledDate: string;
    scheduledTime: string;
    status?: AppointmentStatus;
    serviceName?: string;
    categoryName?: string;
    notes?: string | null;
  };
  provider: { firstName: string; lastName: string; photoUrl: string | null };
};

export type NotificationType =
  | "APPOINTMENT_NEW_REQUEST"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_REFUSED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_RESCHEDULE_ACCEPTED"
  | "APPOINTMENT_RESCHEDULE_DECLINED"
  | "APPOINTMENT_CANCELLED_CLIENT"
  | "APPOINTMENT_CANCELLED_PROVIDER"
  | "APPOINTMENT_REMINDER_24H"
  | "APPOINTMENT_REMINDER_1H"
  | "APPOINTMENT_EN_ROUTE"
  | "APPOINTMENT_STARTED"
  | "APPOINTMENT_PROVIDER_ENDED"
  | "APPOINTMENT_COMPLETED"
  | "ACCOUNT_VERIFIED"
  | "ACCOUNT_REJECTED"
  | "DOCUMENT_ACCEPTED"
  | "DOCUMENT_REJECTED"
  | "NEW_REVIEW"
  | "COMPLAINT_FILED"
  | "COMPLAINT_STATUS_UPDATED"
  | "COMPLAINT_RESOLVED"
  | "COMPLAINT_DISMISSED"
  | "SYSTEM_ANNOUNCEMENT"
  | "EMPLOYEE_INVITATION_RECEIVED"
  | "EMPLOYEE_INVITATION_ACCEPTED"
  | "EMPLOYEE_INVITATION_DECLINED"
  | "EMPLOYEE_INVITATION_CANCELLED"
  | "EMPLOYEE_REMOVED_FROM_COMPANY";

/** A pending employee invitation received by a provider (GET /provider/invitations). */
export type ReceivedInvitation = {
  id: string;
  status: "PENDING";
  message: string | null;
  expiresAt: string;
  createdAt: string;
  company: {
    id: string;
    companyName: string;
    logo: string | null;
    city: string;
    averageRating: number;
    totalReviews: number;
  };
  sentByAdmin: {
    user: { firstName: string; lastName: string };
  };
};

/** Provider's response to an invitation. */
export type RespondInvitationPayload = {
  action: "ACCEPTED" | "DECLINED";
};

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

/** Row from GET `/messaging/conversations` (matches backend include). */
export type ConversationListItem = {
  id: string;
  client: {
    user: { firstName: string; lastName: string };
    imageUrl: string | null;
  };
  provider: {
    user: { firstName: string; lastName: string };
    photoUrl: string | null;
    tagline: string | null;
  };
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageSender: "CLIENT" | "PROVIDER" | null;
  unreadClient: number;
  unreadProvider: number;
};

export type MessageStatus = "SENT" | "DELIVERED" | "READ";

/** Row from GET/POST `/messaging/messages` (matches Prisma `Message`). */
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: "CLIENT" | "PROVIDER";
  text: string | null;
  mediaUrls: string[];
  status: MessageStatus;
  createdAt: string;
};

export type ProviderCalendarAppointment = {
  id: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number | null;
  notes: string | null;
  startedAt: string | null;
  enRouteAt: string | null;
  givenService: { serviceName: string; categoryName: string };
  client: {
    firstName: string;
    lastName: string;
    imageUrl: string | null;
    city: string;
    address: string | null;
  };
};

type CalendarTranslationRow = { locale: string; name: string };

function pickCalendarName(
  translations: CalendarTranslationRow[] | undefined,
): string {
  if (!translations?.length) return "";
  const preferAr = i18n.language?.startsWith("ar");
  const loc = preferAr ? "AR" : "EN";
  const row =
    translations.find((t) => t.locale === loc) ??
    translations.find((t) => t.locale === "EN") ??
    translations[0];
  return row?.name ?? "";
}

function normalizeCalendarDateKey(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

/** Maps one raw row from `GET /appointments/calendar` into a typed model. */
export function mapProviderCalendarAppointmentRow(
  raw: unknown,
): ProviderCalendarAppointment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id;
  if (typeof id !== "string") return null;

  const scheduledDate = normalizeCalendarDateKey(r.scheduledDate);
  if (!scheduledDate) return null;

  const status = r.status as AppointmentStatus;
  const scheduledTime =
    typeof r.scheduledTime === "string" ? r.scheduledTime : "00:00";
  const durationMinutes =
    typeof r.durationMinutes === "number" ? r.durationMinutes : null;
  const notes =
    typeof r.notes === "string" ? r.notes : ((r.notes as null) ?? null);
  const startedAt =
    r.startedAt != null && r.startedAt !== ""
      ? String(r.startedAt)
      : null;
  const enRouteAt =
    r.enRouteAt != null && r.enRouteAt !== "" ? String(r.enRouteAt) : null;

  let serviceName = "";
  let categoryName = "";
  const gs = r.givenService;
  if (gs && typeof gs === "object") {
    const g = gs as Record<string, unknown>;
    if (typeof g.serviceName === "string") serviceName = g.serviceName;
    if (typeof g.categoryName === "string") categoryName = g.categoryName;
    const svc = g.service;
    if (svc && typeof svc === "object") {
      const s = svc as Record<string, unknown>;
      const tr = s.translations as CalendarTranslationRow[] | undefined;
      const cat = s.category as Record<string, unknown> | undefined;
      if (!serviceName) serviceName = pickCalendarName(tr);
      if (cat && typeof cat === "object") {
        const ctr = cat.translations as CalendarTranslationRow[] | undefined;
        if (!categoryName) categoryName = pickCalendarName(ctr);
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
    if (typeof c.imageUrl === "string") imageUrl = c.imageUrl;
    else if (c.imageUrl === null) imageUrl = null;
    if (typeof c.city === "string") city = c.city;
    if (typeof c.address === "string") address = c.address;
    else if (c.address === null) address = null;
    const user = c.user;
    if (user && typeof user === "object") {
      const u = user as Record<string, unknown>;
      if (typeof u.firstName === "string") firstName = u.firstName;
      if (typeof u.lastName === "string") lastName = u.lastName;
    }
  }

  return {
    id,
    status,
    scheduledDate,
    scheduledTime,
    durationMinutes,
    notes,
    startedAt,
    enRouteAt,
    givenService: {
      serviceName: serviceName || "Service",
      categoryName: categoryName || "Category",
    },
    client: {
      firstName,
      lastName,
      imageUrl,
      city,
      address,
    },
  };
}

// Storage keys
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: CONFIG.api.baseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      config.headers["Accept-Language"] = i18n.language?.startsWith("ar")
        ? "ar"
        : "en";
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error getting token:", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data, error: refreshErr } =
          await supabase.auth.refreshSession();
        if (refreshErr || !data.session) {
          throw refreshErr ?? new Error("No session after refresh");
        }

        await SecureStore.setItemAsync(
          ACCESS_TOKEN_KEY,
          data.session.access_token,
        );
        await SecureStore.setItemAsync(
          REFRESH_TOKEN_KEY,
          data.session.refresh_token,
        );

        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// API helper functions
export const api = {
  // Auth endpoints
  completeRegistration: (data: any) =>
    apiClient.post("/auth/complete-registration", data),
  getCurrentUser: () => apiClient.get("/auth/me"),
  lookupMagicLoginAccount: (data: { email: string }) =>
    apiClient.post<{ exists: boolean }>("/auth/magic-login/lookup", data),
  checkEmailChangeAvailability: (data: { email: string }) =>
    apiClient.post<{ available: boolean }>("/auth/email-change/check", data),

  // User endpoints
  updateProfile: (data: any) => apiClient.put("/users/me", data),
  deleteAccount: () => apiClient.delete("/users/me"),

  // Client endpoints (role CLIENT)
  getClientMe: () => apiClient.get("/clients/me"),
  updateClientMe: (data: Record<string, unknown>) =>
    apiClient.patch("/clients/me", data),
  getClientSearchHistory: (params?: { lang?: "en" | "ar" }) =>
    apiClient.get("/clients/me/search-history", { params }),
  addClientSearchHistory: (data: { serviceId: string; query?: string }) =>
    apiClient.post("/clients/me/search-history", data),
  clearClientSearchHistory: () => apiClient.delete("/clients/me/search-history"),
  getClientFavorites: (params?: { type?: FavoriteType; lang?: "en" | "ar" }) =>
    apiClient.get<{
      items: {
        id: string;
        type: FavoriteType;
        targetId: string;
        title: string;
        subtitle: string | null;
        imageUrl: string | null;
        givenServiceId?: string;
        createdAt: string;
      }[];
    }>("/favorites", {
      params: {
        ...params,
        lang: params?.lang ?? (i18n.language?.startsWith("ar") ? "ar" : "en"),
      },
    }),
  createClientFavorite: (data: { type: FavoriteType; targetId: string }) =>
    apiClient.post("/favorites", data),
  deleteClientFavorite: (type: FavoriteType, targetId: string) =>
    apiClient.delete(`/favorites/${type}/${targetId}`),
  clearClientFavorites: (type?: FavoriteType) =>
    apiClient.delete("/favorites", { params: { type } }),
  softDeleteClientAccount: (data: { password: string }) =>
    apiClient.post<{ message: string; deletedAt: string }>(
      "/clients/me/soft-delete",
      data,
    ),

  // Provider endpoints
  getProviderProfile: () => apiClient.get("/providers/me"),
  updateProviderProfile: (data: any) => apiClient.patch("/providers/me", data),

  /** Provider weekly availability (GET/PATCH `/availability/me`). */
  getMyAvailability: () =>
    apiClient.get<ProviderAvailabilityDay[]>("/availability/me"),

  upsertAvailability: (payload: UpsertProviderAvailabilityPayload) =>
    apiClient.patch<ProviderAvailabilityDay[]>("/availability/me", payload),

  getMyDaysOff: (from?: string, to?: string) =>
    apiClient.get<ProviderDayOffItem[]>("/availability/days-off/me", {
      params: { from, to },
    }),

  createDayOff: (payload: { date: string; reason?: string }) =>
    apiClient.post<ProviderDayOffItem>("/availability/days-off", payload),

  deleteDayOff: (id: string) =>
    apiClient.delete(`/availability/days-off/${id}`),

  getProviderCalendar: (from: string, to: string) =>
    apiClient.get<unknown[]>("/appointments/calendar", {
      params: { from, to },
    }),

  getAppointmentById: (id: string) =>
    apiClient.get<unknown>(`/appointments/${id}`),

  getMyAppointmentsAsClient: (status?: AppointmentStatus) =>
    apiClient.get<unknown[]>("/appointments/me/client", {
      params: status ? { status } : {},
    }),

  clientRespondReschedule: (
    appointmentId: string,
    payload: { action: "CONFIRMED" | "CANCELLED_CLIENT" },
  ) =>
    apiClient.patch<{
      id: string;
      status: AppointmentStatus;
      scheduledDate: string;
      scheduledTime: string;
      rescheduleDate: string | null;
      rescheduleTime: string | null;
    }>(`/appointments/${appointmentId}/client-respond`, payload),

  providerRespond: (
    id: string,
    payload: {
      action: "CONFIRMED" | "REFUSED" | "RESCHEDULED";
      refusalReason?: string;
      rescheduleDate?: string;
      rescheduleTime?: string;
    },
  ) => apiClient.patch(`/appointments/${id}/respond`, payload),

  recordExecution: (
    id: string,
    payload: {
      action: "EN_ROUTE" | "START" | "END";
      photoUrls?: string[];
    },
  ) => apiClient.patch(`/appointments/${id}/execution`, payload),

  cancelAppointment: (id: string, data?: { reason?: string }) =>
    apiClient.patch(`/appointments/${id}/cancel`, data ?? {}),

  clientConfirm: (id: string, payload: { type: "START" | "END" }) =>
    apiClient.patch<unknown>(`/appointments/${id}/confirm`, payload),

  registerPushToken: (payload: { token: string; platform: "ios" | "android" }) =>
    apiClient.post("/notifications/push-token", payload),
  getMyNotifications: (skip = 0, take = 30) =>
    apiClient.get<AppNotification[]>("/notifications", { params: { skip, take } }),
  getUnreadCount: () => apiClient.get<{ count: number }>("/notifications/unread-count"),
  markNotificationsRead: (ids?: string[]) =>
    apiClient.patch("/notifications/mark-read", ids?.length ? { ids } : {}),
  markAllAsRead: () => apiClient.patch("/notifications/mark-read", {}),

  getMyConversations: () =>
    apiClient.get<ConversationListItem[]>("/messaging/conversations"),

  openOrCreateConversation: (payload: { counterpartId: string }) =>
    apiClient.post<{ id: string }>("/messaging/conversations", payload),

  getMessages: (conversationId: string, take = 30, before?: string) =>
    apiClient.get<ChatMessage[]>("/messaging/messages", {
      params: {
        conversationId,
        take,
        ...(before ? { before } : {}),
      },
    }),

  sendMessage: (payload: {
    conversationId: string;
    text?: string;
    mediaUrls?: string[];
  }) => apiClient.post<ChatMessage>("/messaging/messages", payload),

  markConversationRead: (conversationId: string) =>
    apiClient.patch("/messaging/messages/read", { conversationId }),

  softDeleteProviderAccount: (data: { password: string }) =>
    apiClient.post<{ message: string; deletedAt: string }>(
      "/providers/me/soft-delete",
      data,
    ),

  getProviderGivenService: (serviceId: string) =>
    apiClient.get(`/providers/me/given-services/${serviceId}`),

  updateProviderGivenService: (
    serviceId: string,
    data: Record<string, unknown>,
  ) => apiClient.patch(`/providers/me/given-services/${serviceId}`, data),

  getProviderServiceGallery: (serviceId: string) =>
    apiClient.get(`/providers/me/given-services/${serviceId}/gallery`),

  updateProviderServiceGallery: (
    serviceId: string,
    data: { imageUrls: string[] },
  ) => apiClient.patch(`/providers/me/given-services/${serviceId}/gallery`, data),

  // Company endpoints
  getCompanyProfile: () => apiClient.get("/companies/me"),
  updateCompanyProfile: (data: any) => apiClient.put("/companies/me", data),

  // Marketplace catalog
  listServices: (params?: { categoryId?: string; categorySlug?: string }) =>
    apiClient.get("/services", {
      params: {
        ...params,
        lang: i18n.language?.startsWith("ar") ? "ar" : "en",
      },
    }),

  /** Active services in a single category (same payload as `listServices({ categoryId })`). */
  listServicesByCategoryId: (categoryId: string) =>
    apiClient.get(`/services/category/${categoryId}`, {
      params: {
        lang: i18n.language?.startsWith("ar") ? "ar" : "en",
      },
    }),

  /** Active `given_services` rows for a catalog service (marketplace provider/company count). */
  getCatalogServiceActiveGivenCount: (serviceId: string) =>
    apiClient.get<{ count: number }>(
      `/services/${serviceId}/active-given-count`,
    ),

  listServiceCategories: () =>
    apiClient.get("/service-categories", {
      params: {
        lang: i18n.language?.startsWith("ar") ? "ar" : "en",
      },
    }),

  searchProviders: (params: {
    serviceId: string;
    city?: string;
    clientLat?: number;
    clientLng?: number;
    maxPrice?: number;
    minRating?: number;
    ownerType?: "PROVIDER" | "COMPANY";
    pricingType?: string;
    isAvailableImmediately?: boolean;
    isTopProvider?: boolean;
    gender?: string;
    sort?: string;
    locale?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get("/search/providers", { params }),

  getGivenServiceDetails: (givenServiceId: string, params?: { locale?: string }) =>
    apiClient.get(`/given-services/${givenServiceId}`, { params }),

  getAvailableSlots: (providerId: string, date: string, duration: number) =>
    apiClient.get<string[]>(`/availability/${providerId}/slots`, {
      params: { date, duration },
    }),

  createAppointment: (payload: {
    givenServiceId: string;
    providerId: string;
    scheduledDate: string;
    scheduledTime: string;
    notes?: string;
    photoUrls?: string[];
    latitude?: number;
    longitude?: number;
  }) =>
    apiClient.post<{ id: string }>("/appointments", payload),

  // Platform admin — verification queue
  listAdminUsers: (params?: {
    role?: UserRole;
    skip?: number;
    take?: number;
  }) => apiClient.get("/admin/users", { params }),

  listAdminVerificationRequests: (params?: {
    status?: string;
    userId?: string;
    ownerType?: "PROVIDER" | "COMPANY";
    skip?: number;
    take?: number;
  }) => apiClient.get("/admin/verification-requests", { params }),

  getAdminVerificationRequest: (id: string) =>
    apiClient.get(`/admin/verification-requests/${id}`),

  markVerificationUnderReview: (id: string) =>
    apiClient.patch(`/admin/verification-requests/${id}/review`),

  approveVerificationRequest: (id: string) =>
    apiClient.post(`/admin/verification-requests/${id}/approve`),

  rejectVerificationRequest: (id: string, data: { reason: string }) =>
    apiClient.post(`/admin/verification-requests/${id}/reject`, data),

  reviewVerificationDocument: (
    requestId: string,
    documentId: string,
    data: { decision: "accept" | "reject"; rejectionReason?: string },
  ) =>
    apiClient.patch(
      `/admin/verification-requests/${requestId}/documents/${documentId}`,
      data,
    ),

  // Current provider/company admin — latest own verification request
  getMyLatestVerificationRequest: () =>
    apiClient.get("/verification-requests/me/latest"),
  getMyVerificationRequests: () => apiClient.get("/verification-requests/me/requests"),
  getMyVerificationDocuments: () =>
    apiClient.get("/verification-requests/me/documents"),

  resubmitVerificationRequest: (data: {
    ownerComment?: string | null;
    documents: { type: string; fichierUrl: string }[];
  }) => apiClient.post("/verification-requests/me/resubmit", data),

  createProviderServiceRequest: (data: {
    serviceId: string;
    ownerComment?: string | null;
    documents: { type: string; fichierUrl: string }[];
  }) => apiClient.post("/verification-requests/me/provider-service-request", data),

  getLatestLegalDocument: (type: "TERMS" | "PRIVACY") =>
    apiClient.get<{
      type: "TERMS" | "PRIVACY";
      locale: "EN" | "AR";
      title: string;
      version: number;
      contentMarkdown: string;
      summary: string | null;
      publishedAt: string | null;
      documentId: string;
      versionId: string;
    }>("/legal-documents/latest", {
      params: {
        type,
        lang: i18n.language?.startsWith("ar") ? "ar" : "en",
      },
    }),

  checkCanReview: (appointmentId: string) =>
    apiClient.get<{
      canReview: boolean;
      alreadyReviewed: boolean;
      existingRating: number | null;
      existingComment: string | null;
    }>(`/reviews/can-review/${appointmentId}`),

  getProviderReviews: (
    providerId: string,
    params?: {
      givenServiceId?: string;
      minRating?: number;
      take?: number;
      skip?: number;
      sort?: "recent" | "highest" | "lowest";
    },
  ) =>
    apiClient.get<{
      items: unknown[];
      total: number;
      averageRating: number;
    }>(`/reviews/provider/${providerId}`, { params }),

  getProviderReviewsBreakdown: (providerId: string) =>
    apiClient.get<{ star: number; count: number; percentage: number }[]>(
      `/reviews/provider/${providerId}/breakdown`,
    ),

  replyToReview: (reviewId: string, payload: { providerReply: string }) =>
    apiClient.patch<{
      id: string;
      providerReply: string | null;
      repliedAt: string | null;
    }>(`/reviews/${reviewId}/reply`, payload),

  createReview: (payload: {
    appointmentId: string;
    rating: number;
    comment?: string;
  }) => apiClient.post<unknown>("/reviews", payload),

  createComplaint: (payload: {
    appointmentId: string;
    category: ComplaintCategory;
    description: string;
    evidenceUrls?: string[];
  }) => apiClient.post<unknown>("/complaints", payload),

  getMyComplaints: () => apiClient.get<unknown[]>("/complaints/me"),

  getComplaintById: (id: string) => apiClient.get<unknown>(`/complaints/${id}`),

  withdrawComplaint: (id: string, payload?: { reason?: string }) =>
    apiClient.patch<unknown>(`/complaints/${id}/withdraw`, payload ?? {}),

  getAllComplaints: (filters?: {
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    take?: number;
    skip?: number;
    sort?: "recent" | "oldest";
    providerId?: string;
    clientId?: string;
  }) =>
    apiClient.get<AdminComplaintsListResponse>("/complaints", {
      params: Object.fromEntries(
        Object.entries(filters ?? {}).filter(
          ([, v]) => v !== undefined && v !== "",
        ),
      ),
    }),

  reviewComplaint: (
    id: string,
    payload: {
      status: ComplaintStatus;
      adminNotes?: string;
      adminResponse?: string;
      decision?: ComplaintDecision;
    },
  ) => apiClient.patch<unknown>(`/complaints/${id}/review`, payload),

  getMyProviderComplaints: () =>
    apiClient.get<ProviderComplaintsSummaryResponse>(
      "/complaints/my-provider-complaints",
    ),

  // Employee invitations (role PROVIDER)
  getMyReceivedInvitations: () =>
    apiClient.get<ReceivedInvitation[]>("/provider/invitations"),

  respondToInvitation: (id: string, payload: RespondInvitationPayload) =>
    apiClient.patch<unknown>(`/provider/invitations/${id}/respond`, payload),
};

export default apiClient;
