// src/types/auth.types.ts

import type { Session } from "@supabase/supabase-js";

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
