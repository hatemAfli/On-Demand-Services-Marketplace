// src/services/supabase.ts

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { CONFIG } from "../constants";

// Custom storage implementation using Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("SecureStore getItem error:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};

// Create Supabase client
export const supabase = createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.anonKey,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export const getAuthRedirectUrl = () => Linking.createURL("auth/callback");

function getParamsFromUrl(url: string): URLSearchParams {
  const query = url.includes("?") ? url.split("?")[1].split("#")[0] : "";
  const hash = url.includes("#") ? url.split("#")[1] : "";
  const merged = [query, hash].filter(Boolean).join("&");
  return new URLSearchParams(merged);
}

export const handleAuthDeepLink = async (url: string): Promise<boolean> => {
  try {
    const params = getParamsFromUrl(url);
    const code = params.get("code");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Deep link code exchange failed:", error.message);
        return false;
      }
      return true;
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.error("Deep link setSession failed:", error.message);
        return false;
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error("Deep link handler failed:", error);
    return false;
  }
};

// Helper function to test connection
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("❌ Supabase connection failed:", error.message);
      return false;
    }
    console.log("✅ Supabase connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Supabase connection error:", error);
    return false;
  }
};
