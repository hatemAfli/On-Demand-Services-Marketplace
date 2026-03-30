// src/services/supabase.ts

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
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
