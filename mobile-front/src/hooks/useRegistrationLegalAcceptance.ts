import { useCallback, useEffect, useState } from "react";
import { useAppTranslation } from "./useAppTranslation";
import {
  getPendingLegalAcceptance,
  type PendingLegalAcceptance,
} from "../services/legal-acceptance";

export function useRegistrationLegalAcceptance() {
  const { t } = useAppTranslation();
  const [accepted, setAccepted] = useState(false);
  const [versionIds, setVersionIds] = useState<string[]>([]);
  const [needsUi, setNeedsUi] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const pending: PendingLegalAcceptance | null =
        await getPendingLegalAcceptance();
      if (cancelled) return;

      if (pending?.documentVersionIds?.length === 2) {
        setVersionIds(pending.documentVersionIds);
        setAccepted(true);
        setNeedsUi(false);
      } else {
        setNeedsUi(true);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const requireForSubmit = useCallback(() => {
    if (!accepted || versionIds.length < 2) {
      throw new Error(t("auth.legalAcceptanceRequired"));
    }
    return { documentVersionIds: versionIds };
  }, [accepted, t, versionIds]);

  return {
    accepted,
    setAccepted,
    versionIds,
    setVersionIds,
    needsUi,
    loading,
    requireForSubmit,
  };
}
