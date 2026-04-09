// src/services/auth.service.ts

import type { Session, User } from "@supabase/supabase-js";
import { getAuthRedirectUrl, supabase } from "./supabase";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { UserRole, UserWithProfile } from "../types";
import type { EmailSignUpResult } from "../types/auth.types";

// Storage keys
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

/** Maps mobile screen payloads to NestJS `POST /auth/complete-registration` body. */
function mapCompleteRegistrationBody(profileData: {
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  role: UserRole | string;
  client?: {
    city: string;
    address?: string;
    imageUrl?: string;
  };
  provider?: {
    type?: string;
    city: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    photoUrl?: string;
    companyId?: string;
  };
  companyAdmin?: {
    companyId: string;
  };
}) {
  const base = {
    phoneNumber: profileData.phoneNumber,
    firstName: profileData.firstName,
    lastName: profileData.lastName,
    role: profileData.role,
  };

  const role = String(profileData.role);

  if (role === "CLIENT") {
    if (!profileData.client?.city) {
      throw new Error("City is required to complete your client profile");
    }
    return { ...base, client: profileData.client };
  }

  if (role === "PROVIDER") {
    if (!profileData.provider?.city) {
      throw new Error("City is required to complete your provider profile");
    }
    return { ...base, provider: profileData.provider };
  }

  if (role === "COMPANY_ADMIN") {
    const companyId = profileData.companyAdmin?.companyId?.trim();
    if (!companyId) {
      throw new Error(
        "Company ID is required. Use the UUID provided by your organization.",
      );
    }
    return {
      ...base,
      companyAdmin: { companyId },
    };
  }

  return base;
}

async function persistSessionTokens(session: Session | null) {
  if (!session) return;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.access_token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
}

/** Clears Supabase session and local tokens (used after duplicate-signup full account, or failed login recovery). */
async function clearLocalAuthState() {
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    /* ignore */
  }
}

function isEmailAlreadyRegisteredError(error: {
  message?: string;
  code?: string;
}): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String((error as { code?: string }).code ?? "");
  return (
    code === "email_exists" ||
    code === "user_already_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already registered")
  );
}

/**
 * With "Confirm email" (and related settings) enabled, Supabase does not return an error
 * for duplicate signups — it returns success + no session + an obfuscated user whose
 * `identities` array is empty (no new identity created). Real first-time signups always
 * include at least one identity when a user object is returned.
 */
function isDuplicateSignupObfuscatedResponse(
  user: User | null | undefined,
  session: Session | null | undefined,
): boolean {
  if (!user || session) return false;
  const ids = user.identities;
  return Array.isArray(ids) && ids.length === 0;
}

type SignInProfileKind = "full" | "incomplete" | "signin_failed";

async function signInAndClassifyProfile(
  email: string,
  password: string,
): Promise<{
  kind: SignInProfileKind;
  session?: Session;
  user?: UserWithProfile;
}> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { kind: "signin_failed" };
  }

  await persistSessionTokens(data.session);

  try {
    const userProfile = await api.getCurrentUser();
    return {
      kind: "full",
      session: data.session,
      user: userProfile.data as UserWithProfile,
    };
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (status === 400) {
      return { kind: "incomplete", session: data.session };
    }
    await clearLocalAuthState();
    throw e;
  }
}

export const authService = {
  api,
  persistSessionTokens,
  // ==================== LOGIN ====================

  async loginWithEmail(
    email: string,
    password: string,
  ): Promise<{ session: Session; user: UserWithProfile | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || "Login failed");
    }

    if (!data.session) {
      throw new Error("Login failed");
    }

    await persistSessionTokens(data.session);

    try {
      const userProfile = await api.getCurrentUser();
      await SecureStore.setItemAsync(
        USER_KEY,
        JSON.stringify(userProfile.data),
      );
      return {
        session: data.session,
        user: userProfile.data as UserWithProfile,
      };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      if (status === 400) {
        await SecureStore.deleteItemAsync(USER_KEY);
        return { session: data.session, user: null };
      }
      await clearLocalAuthState();
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (e as Error)?.message;
      throw new Error(msg || "Login failed");
    }
  },

  async loginWithPhone(
    phone: string,
    password: string,
  ): Promise<{ session: Session; user: UserWithProfile | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });

    if (error) {
      throw new Error(error.message || "Login failed");
    }

    if (!data.session) {
      throw new Error("Login failed");
    }

    await persistSessionTokens(data.session);

    try {
      const userProfile = await api.getCurrentUser();
      await SecureStore.setItemAsync(
        USER_KEY,
        JSON.stringify(userProfile.data),
      );
      return {
        session: data.session,
        user: userProfile.data as UserWithProfile,
      };
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response
        ?.status;
      if (status === 400) {
        await SecureStore.deleteItemAsync(USER_KEY);
        return { session: data.session, user: null };
      }
      await clearLocalAuthState();
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? (e as Error)?.message;
      throw new Error(msg || "Login failed");
    }
  },

  // ==================== SIGNUP ====================

  async signUpWithEmail(
    email: string,
    password: string,
    role: UserRole,
  ): Promise<EmailSignUpResult> {
    const emailRedirectTo = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          selected_role: role,
        },
      },
    });

    if (error) {
      if (isEmailAlreadyRegisteredError(error)) {
        const classified = await signInAndClassifyProfile(email, password);
        if (classified.kind === "signin_failed") {
          return { outcome: "existingAccount", variant: "wrong_password" };
        }
        if (classified.kind === "full") {
          await clearLocalAuthState();
          return { outcome: "existingAccount", variant: "use_login" };
        }
        return { outcome: "resumeProfile", session: classified.session! };
      }
      throw new Error(error.message || "Signup failed");
    }

    if (isDuplicateSignupObfuscatedResponse(data.user, data.session)) {
      const classified = await signInAndClassifyProfile(email, password);
      if (classified.kind === "signin_failed") {
        return { outcome: "existingAccount", variant: "wrong_password" };
      }
      if (classified.kind === "full") {
        await clearLocalAuthState();
        return { outcome: "existingAccount", variant: "use_login" };
      }
      return { outcome: "resumeProfile", session: classified.session! };
    }

    if (data.session) {
      await persistSessionTokens(data.session);
    }

    return {
      outcome: "new",
      user: data.user,
      session: data.session,
      needsEmailConfirmation: !data.session,
    };
  },

  async signUpWithPhone(phone: string, password: string, role: UserRole) {
    try {
      // First, send OTP
      const { data: otpData, error: otpError } =
        await supabase.auth.signInWithOtp({
          phone,
        });

      if (otpError) throw otpError;

      // Store phone and role temporarily for later use
      await SecureStore.setItemAsync("tempPhone", phone);
      await SecureStore.setItemAsync("tempPassword", password);
      await SecureStore.setItemAsync("tempRole", role);

      return {
        success: true,
        message: "OTP sent to your phone",
      };
    } catch (error: any) {
      console.error("Phone signup error:", error);
      throw new Error(error.message || "Phone signup failed");
    }
  },

  // ==================== OTP VERIFICATION ====================

  async verifyOTP(phone: string, token: string) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });

      if (error) throw error;

      // After OTP verification, create user with password
      const tempPassword = await SecureStore.getItemAsync("tempPassword");
      const tempRole = await SecureStore.getItemAsync("tempRole");

      if (tempPassword && data.user) {
        // Update user with password
        const { error: updateError } = await supabase.auth.updateUser({
          password: tempPassword,
          data: {
            selected_role: tempRole,
          },
        });

        if (updateError) throw updateError;

        // Clean up temp storage
        await SecureStore.deleteItemAsync("tempPhone");
        await SecureStore.deleteItemAsync("tempPassword");
        await SecureStore.deleteItemAsync("tempRole");
      }

      if (data.session) {
        await persistSessionTokens(data.session);
      }

      return {
        session: data.session,
        user: data.user,
      };
    } catch (error: any) {
      console.error("OTP verification error:", error);
      throw new Error(error.message || "OTP verification failed");
    }
  },

  // ==================== PROFILE COMPLETION ====================

  async completeRegistration(
    profileData: Parameters<typeof mapCompleteRegistrationBody>[0],
  ) {
    try {
      const body = mapCompleteRegistrationBody(profileData);
      const response = await api.completeRegistration(body);

      await SecureStore.setItemAsync(
        USER_KEY,
        JSON.stringify(response.data.user),
      );

      return response.data;
    } catch (error: any) {
      console.error("Profile completion error:", error);
      const msg =
        error.response?.data?.message ??
        error.response?.data?.error ??
        error.message;
      throw new Error(
        Array.isArray(msg)
          ? msg.join(", ")
          : msg || "Profile completion failed",
      );
    }
  },

  // ==================== SESSION MANAGEMENT ====================

  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      return data.session;
    } catch (error) {
      console.error("Get session error:", error);
      return null;
    }
  },

  async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) throw error;

      if (data.session) {
        await persistSessionTokens(data.session);
      }

      return data.session;
    } catch (error) {
      console.error("Refresh session error:", error);
      return null;
    }
  },

  async logout() {
    try {
      await clearLocalAuthState();
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  },

  // ==================== HELPERS ====================

  async getStoredUser() {
    try {
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error("Get stored user error:", error);
      return null;
    }
  },

  async clearStoredProfile() {
    try {
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.error("Clear stored profile error:", error);
    }
  },

  async getAccessToken() {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error("Get access token error:", error);
      return null;
    }
  },
};

export { api };
