// src/utils/passwordStrength.ts

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Returns 0 when empty; 1–4 for weak → strong based on length and character classes.
 */
export function scorePasswordStrength(password: string): {
  level: PasswordStrengthLevel;
} {
  if (!password.length) {
    return { level: 0 };
  }

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  let level: PasswordStrengthLevel = 1;
  if (score <= 2) level = 1;
  else if (score <= 4) level = 2;
  else if (score <= 6) level = 3;
  else level = 4;

  return { level };
}
