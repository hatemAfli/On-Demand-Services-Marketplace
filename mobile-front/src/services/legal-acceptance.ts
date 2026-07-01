import * as SecureStore from "expo-secure-store";
import { api } from "./api";

const PENDING_LEGAL_ACCEPTANCE_KEY = "pendingLegalAcceptance";

export type PendingLegalAcceptance = {
  documentVersionIds: string[];
};

export async function fetchLatestLegalVersionIds(): Promise<string[]> {
  const [terms, privacy] = await Promise.all([
    api.getLatestLegalDocument("TERMS"),
    api.getLatestLegalDocument("PRIVACY"),
  ]);

  const termsId = terms.data?.versionId;
  const privacyId = privacy.data?.versionId;

  if (!termsId || !privacyId) {
    throw new Error("Latest legal documents are unavailable. Please try again.");
  }

  return [termsId, privacyId];
}

export async function storePendingLegalAcceptance(
  data: PendingLegalAcceptance,
): Promise<void> {
  await SecureStore.setItemAsync(
    PENDING_LEGAL_ACCEPTANCE_KEY,
    JSON.stringify(data),
  );
}

export async function getPendingLegalAcceptance(): Promise<PendingLegalAcceptance | null> {
  const raw = await SecureStore.getItemAsync(PENDING_LEGAL_ACCEPTANCE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingLegalAcceptance;
    if (
      !Array.isArray(parsed.documentVersionIds) ||
      parsed.documentVersionIds.length < 2
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingLegalAcceptance(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_LEGAL_ACCEPTANCE_KEY);
}

export async function resolveLegalAcceptancesForRegistration(
  fromForm?: string[] | null,
): Promise<{ documentVersionIds: string[] }> {
  if (fromForm?.length === 2) {
    return { documentVersionIds: fromForm };
  }

  const pending = await getPendingLegalAcceptance();
  if (pending?.documentVersionIds?.length === 2) {
    return { documentVersionIds: pending.documentVersionIds };
  }

  throw new Error(
    "You must accept the Terms and Privacy Policy to complete registration.",
  );
}
