import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useNotificationsRealtime } from "../../context/NotificationsRealtimeContext";
import { navigationRef } from "../../navigation/rootNavigationRef";
import { api } from "../../services/api";
import { isEmployeeProvider } from "../../utils/providerEmployment";
import {
  INCOMING_REQUEST_TIMEOUT_SEC,
  type IncomingJobRequestData,
  clientDisplayName,
  estimateEtaMinutes,
  haversineKm,
  parseIncomingJobRequest,
} from "../../utils/incomingJobRequest";
import { IncomingJobRequestScreen } from "../../screens/provider/incoming/IncomingJobRequestScreen";
import { useAppTranslation } from "../../hooks/useAppTranslation";

function extractAppointmentId(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const id = data.appointmentId ?? data.appointment_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export const ProviderIncomingRequestOverlay: React.FC = () => {
  const { user } = useAuth();
  const { t } = useAppTranslation();
  const { addNewNotificationListener } = useNotificationsRealtime();

  const isEmployee = isEmployeeProvider(user);
  const [queue, setQueue] = useState<string[]>([]);
  const [active, setActive] = useState<IncomingJobRequestData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(
    INCOMING_REQUEST_TIMEOUT_SEC,
  );
  const [acceptPct, setAcceptPct] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const seenIdsRef = useRef(new Set<string>());
  const timeoutHandledRef = useRef(false);
  const deadlineRef = useRef<number | null>(null);

  const providerLat = user?.provider?.latitude ?? null;
  const providerLng = user?.provider?.longitude ?? null;

  const distanceKm = useMemo(() => {
    if (
      active?.latitude == null ||
      active.longitude == null ||
      providerLat == null ||
      providerLng == null
    ) {
      return null;
    }
    return haversineKm(providerLat, providerLng, active.latitude, active.longitude);
  }, [active, providerLat, providerLng]);

  const etaMinutes = distanceKm != null ? estimateEtaMinutes(distanceKm) : null;

  const enqueue = useCallback((appointmentId: string) => {
    if (seenIdsRef.current.has(appointmentId)) return;
    seenIdsRef.current.add(appointmentId);
    setQueue((prev) => (prev.includes(appointmentId) ? prev : [...prev, appointmentId]));
  }, []);

  useEffect(() => {
    if (isEmployee) return;
    return addNewNotificationListener((notification) => {
      if (notification.type !== "APPOINTMENT_NEW_REQUEST") return;
      const appointmentId = extractAppointmentId(notification.data);
      if (!appointmentId) return;
      enqueue(appointmentId);
    });
  }, [addNewNotificationListener, enqueue, isEmployee]);

  useEffect(() => {
    if (isEmployee) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getProviderDashboard();
        if (!cancelled) {
          setAcceptPct(res.data?.performance?.acceptPct ?? null);
        }
      } catch {
        if (!cancelled) setAcceptPct(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEmployee]);

  const closeActive = useCallback(() => {
    setActive(null);
    setLoadingId(null);
    setIsSubmitting(false);
    setSecondsRemaining(INCOMING_REQUEST_TIMEOUT_SEC);
    deadlineRef.current = null;
    timeoutHandledRef.current = false;
    setQueue((prev) => prev.slice(1));
  }, []);

  const loadNext = useCallback(async () => {
    if (active || loadingId || queue.length === 0) return;
    const nextId = queue[0];
    setLoadingId(nextId);
    try {
      const res = await api.getAppointmentById(nextId);
      const parsed = parseIncomingJobRequest(res.data);
      if (!parsed || parsed.status !== "PENDING") {
        setQueue((prev) => prev.filter((id) => id !== nextId));
        return;
      }
      setActive(parsed);
      setSecondsRemaining(INCOMING_REQUEST_TIMEOUT_SEC);
      deadlineRef.current = Date.now() + INCOMING_REQUEST_TIMEOUT_SEC * 1000;
      timeoutHandledRef.current = false;
    } catch {
      setQueue((prev) => prev.filter((id) => id !== nextId));
    } finally {
      setLoadingId(null);
    }
  }, [active, loadingId, queue]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  useEffect(() => {
    if (!active || !deadlineRef.current) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current! - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
      if (remaining <= 0 && !timeoutHandledRef.current && !isSubmitting) {
        timeoutHandledRef.current = true;
        closeActive();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, closeActive, isSubmitting]);

  const handleAccept = useCallback(async () => {
    if (!active || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.providerRespond(active.id, { action: "CONFIRMED" });
      const appointmentId = active.id;
      closeActive();
      if (navigationRef.current?.isReady?.()) {
        navigationRef.current.navigate("ProviderAppointmentDetail", { appointmentId });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("provider.incomingRequest.acceptFailed");
      Alert.alert(t("common.error"), message);
      setIsSubmitting(false);
    }
  }, [active, closeActive, isSubmitting, t]);

  const handleDecline = useCallback(
    async (reason: string) => {
      if (!active || isSubmitting) return;
      setIsSubmitting(true);
      try {
        await api.providerRespond(active.id, {
          action: "REFUSED",
          refusalReason: reason.trim(),
        });
        closeActive();
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : t("provider.incomingRequest.declineFailed");
        Alert.alert(t("common.error"), message);
        setIsSubmitting(false);
      }
    },
    [active, closeActive, isSubmitting, t],
  );

  const handleViewMap = useCallback(async () => {
    if (!active) return;
    if (active.latitude == null || active.longitude == null) {
      Alert.alert(
        t("common.info"),
        t("provider.incomingRequest.mapUnavailable"),
      );
      return;
    }
    const lat = active.latitude;
    const lng = active.longitude;
    const label = encodeURIComponent(
      clientDisplayName(active.client.firstName, active.client.lastName),
    );
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // fall through
    }
    if (navigationRef.current?.isReady?.()) {
      navigationRef.current.navigate("ProviderItinerary", {
        clientLat: lat,
        clientLng: lng,
        clientName: clientDisplayName(
          active.client.firstName,
          active.client.lastName,
        ),
      });
    }
  }, [active, t]);

  if (isEmployee) return null;

  return (
    <IncomingJobRequestScreen
      visible={!!active}
      data={active}
      secondsRemaining={secondsRemaining}
      acceptPct={acceptPct}
      distanceKm={distanceKm}
      etaMinutes={etaMinutes}
      isSubmitting={isSubmitting}
      onAccept={() => void handleAccept()}
      onDecline={(reason) => void handleDecline(reason)}
      onViewMap={handleViewMap}
    />
  );
};
