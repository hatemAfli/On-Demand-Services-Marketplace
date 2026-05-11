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

export type ProviderCalendarAppointment = {
  id: string;
  status: AppointmentStatus;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number | null;
  notes: string | null;
  givenService: { serviceName: string; categoryName: string };
  client: { firstName: string; lastName: string; imageUrl: string | null };
};

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
};

export default apiClient;
