// src/services/api.ts

import axios, { AxiosInstance, AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { CONFIG } from "../constants";
import type { UserRole } from "../types";
import i18n from "../i18n";
import { supabase } from "./supabase";

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
        const { data, error: refreshErr } = await supabase.auth.refreshSession();
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

  // User endpoints
  updateProfile: (data: any) => apiClient.put("/users/me", data),
  deleteAccount: () => apiClient.delete("/users/me"),

  // Client endpoints (role CLIENT)
  getClientMe: () => apiClient.get("/clients/me"),
  updateClientMe: (data: Record<string, unknown>) =>
    apiClient.patch("/clients/me", data),

  // Provider endpoints
  getProviderProfile: () => apiClient.get("/providers/me"),
  updateProviderProfile: (data: any) => apiClient.put("/providers/me", data),

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

  listServiceCategories: () =>
    apiClient.get("/service-categories", {
      params: {
        lang: i18n.language?.startsWith("ar") ? "ar" : "en",
      },
    }),

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

  // Current provider/company admin — latest own verification request
  getMyLatestVerificationRequest: () =>
    apiClient.get("/verification-requests/me/latest"),

  resubmitVerificationRequest: (data: {
    ownerComment?: string | null;
    documents: { type: string; fichierUrl: string }[];
  }) => apiClient.post("/verification-requests/me/resubmit", data),

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
