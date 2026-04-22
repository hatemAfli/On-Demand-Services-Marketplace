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
  client: {
    city: string;
    address?: string;
    imageUrl?: string;
  };
  provider?: {
    city: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  companyAdmin?: {
    company: {
      companyName: string;
      taxId: string;
      city: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      serviceZones?: string[];
      logo?: string;
    };
    verification: {
      documents: Array<{ type: string; fichierUrl: string }>;
    };
  };
}

export interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
