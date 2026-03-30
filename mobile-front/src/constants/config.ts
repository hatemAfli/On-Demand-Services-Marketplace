// src/constants/config.ts

export const CONFIG = {
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  api: {
    baseUrl:
      process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api",
  },
  app: {
    name: process.env.EXPO_PUBLIC_APP_NAME || "Service Platform",
    version: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
  },
} as const;

// Validation
if (!CONFIG.supabase.url || !CONFIG.supabase.anonKey) {
  console.error("⚠️ Supabase configuration is missing!");
  console.error("Please check your .env file");
}
