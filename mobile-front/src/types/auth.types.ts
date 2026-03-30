// src/types/auth.types.ts

import type { Session } from "@supabase/supabase-js";
import { UserRole } from "./user.types";

/** Result of email sign-up (handles new account, duplicate email, incomplete profile). */
export type EmailSignUpResult =
  | {
      outcome: "new";
      user: unknown;
      session: Session | null;
      needsEmailConfirmation: boolean;
    }
  | {
      outcome: "resumeProfile";
      session: Session;
    }
  | {
      outcome: "existingAccount";
      variant: "use_login" | "wrong_password";
    };

export interface LoginCredentials {
  email: string;
  phoneNumber?: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  role: UserRole;
}

export interface CompleteRegistrationData {
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clientData?: {
    city: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  providerData?: {
    city: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  companyData?: {
    /** Existing company row UUID (required by backend for company admin) */
    companyId: string;
    legalName: string;
    commercialName: string;
    city: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    serviceZones: string[];
    mainContact: string;
  };
}

export interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
