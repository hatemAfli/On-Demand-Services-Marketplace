// src/context/AuthContext.tsx

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { authService } from "../services/auth.service";
import { supabase } from "../services/supabase";
import { UserRole, UserWithProfile } from "../types";
import type { EmailSignUpResult } from "../types/auth.types";
import type { Session } from "@supabase/supabase-js";

const USER_KEY = "user";

interface AuthContextType {
  user: UserWithProfile | null;
  session: Session | null;
  isLoading: boolean;
  /** True when Supabase session exists and backend profile is loaded */
  isAuthenticated: boolean;
  /** True when signed in with Supabase but backend profile is missing */
  needsProfileCompletion: boolean;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, password: string) => Promise<void>;

  signUpWithEmail: (
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<EmailSignUpResult>;
  signUpWithPhone: (
    phone: string,
    password: string,
    role: UserRole,
  ) => Promise<{ success: boolean; message: string }>;

  verifyOTP: (phone: string, token: string) => Promise<void>;

  completeRegistration: (
    profileData: Parameters<typeof authService.completeRegistration>[0],
  ) => Promise<void>;

  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Call after email signup when a session is returned (no confirmation) */
  syncSessionFromSupabase: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getRoleFromSession(s: Session | null): UserRole {
  const raw = s?.user?.user_metadata?.selected_role as string | undefined;
  if (raw === UserRole.PROVIDER || raw === UserRole.COMPANY_ADMIN) {
    return raw;
  }
  return UserRole.CLIENT;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const forceLogoutAndClear = useCallback(async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error("Force logout error:", e);
    } finally {
      setSession(null);
      setUser(null);
      await authService.clearStoredProfile();
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authService.api.getCurrentUser();
      const profile = res.data as UserWithProfile;
      setUser(profile);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profile));
    } catch (error: any) {
      const status = error?.response?.status;

      // If the backend rejects our token, the Supabase user is likely gone.
      if (status === 401) {
        await forceLogoutAndClear();
        return;
      }

      // If backend user isn't found (400), verify token still belongs to a real Supabase user.
      if (status === 400) {
        try {
          const token = await authService.getAccessToken();
          if (token) {
            const { error: supErr } = await supabase.auth.getUser(token);
            if (supErr) {
              await forceLogoutAndClear();
              return;
            }
          }
        } catch (e) {
          // If Supabase verification fails unexpectedly, be safe and logout.
          await forceLogoutAndClear();
          return;
        }
      }

      setUser(null);
      await authService.clearStoredProfile();
    }
  }, []);

  const syncSessionFromSupabase = useCallback(async () => {
    const s = await authService.getSession();
    if (s) {
      await authService.persistSessionTokens(s);
      setSession(s);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentSession = await authService.getSession();

        if (!currentSession) {
          setSession(null);
          setUser(null);
          return;
        }

        await authService.persistSessionTokens(currentSession);
        setSession(currentSession);

        try {
          const res = await authService.api.getCurrentUser();
          setUser(res.data as UserWithProfile);
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.data));
        } catch (error: any) {
          const status = error?.response?.status;

          if (status === 401) {
            await forceLogoutAndClear();
          } else if (status === 400) {
            // Backend user missing: only logout if Supabase user no longer exists.
            try {
              const token = currentSession?.access_token;
              if (token) {
                const { error: supErr } = await supabase.auth.getUser(token);
                if (supErr) {
                  await forceLogoutAndClear();
                } else {
                  setUser(null);
                  await authService.clearStoredProfile();
                }
              } else {
                setUser(null);
                await authService.clearStoredProfile();
              }
            } catch {
              await forceLogoutAndClear();
            }
          } else {
            setUser(null);
            await authService.clearStoredProfile();
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === "SIGNED_IN" && newSession) {
          setSession(newSession);
          await authService.persistSessionTokens(newSession);
          await refreshUser();
        } else if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
        } else if (event === "TOKEN_REFRESHED" && newSession) {
          setSession(newSession);
          await authService.persistSessionTokens(newSession);
        } else if (event === "USER_UPDATED" && newSession) {
          setSession(newSession);
        }
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [refreshUser]);

  const loginWithEmail = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { session: newSession, user: profile } =
        await authService.loginWithEmail(email, password);
      setSession(newSession);
      setUser(profile);
    } catch (error: unknown) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPhone = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const { session: newSession, user: profile } =
        await authService.loginWithPhone(phone, password);
      setSession(newSession);
      setUser(profile);
    } catch (error: unknown) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    role: UserRole,
  ) => {
    setIsLoading(true);
    try {
      const result = await authService.signUpWithEmail(email, password, role);
      if (result.outcome === "resumeProfile") {
        setSession(result.session);
        setUser(null);
      }
      return result;
    } catch (error: unknown) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithPhone = async (
    phone: string,
    password: string,
    role: UserRole,
  ) => {
    setIsLoading(true);
    try {
      return await authService.signUpWithPhone(phone, password, role);
    } catch (error: unknown) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (phone: string, token: string) => {
    setIsLoading(true);
    try {
      const { session: newSession } = await authService.verifyOTP(phone, token);
      if (newSession) {
        setSession(newSession);
        await authService.persistSessionTokens(newSession);
      }
      setUser(null);
    } catch (error: unknown) {
      console.error("OTP verification error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async (
    profileData: Parameters<typeof authService.completeRegistration>[0],
  ) => {
    setIsLoading(true);
    try {
      const result = await authService.completeRegistration(profileData);
      setUser(result.user as UserWithProfile);
    } catch (error: unknown) {
      console.error("Complete registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const needsProfileCompletion = !!session && !user;
  const isAuthenticated = !!session && !!user;

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated,
    needsProfileCompletion,
    loginWithEmail,
    loginWithPhone,
    signUpWithEmail,
    signUpWithPhone,
    verifyOTP,
    completeRegistration,
    logout,
    refreshUser,
    syncSessionFromSupabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export { getRoleFromSession };
