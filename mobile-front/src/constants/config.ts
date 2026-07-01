// src/constants/config.ts

import { resolveApiBaseUrl } from "../utils/resolveApiBaseUrl";

const apiBaseUrl = resolveApiBaseUrl();

export const CONFIG = {
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  api: {
    baseUrl: apiBaseUrl,
  },
  app: {
    name: process.env.EXPO_PUBLIC_APP_NAME || "Service Platform",
    version: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
  },
} as const;

if (__DEV__) {
  console.log(`[API] Using backend base URL: ${CONFIG.api.baseUrl}`);
}

// Validation
if (!CONFIG.supabase.url || !CONFIG.supabase.anonKey) {
  console.error("⚠️ Supabase configuration is missing!");
  console.error("Please check your .env file");
}
