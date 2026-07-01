import { useEffect, useRef } from "react";
import { supabase } from "../services/supabase";

/** Subscribe to live appointment updates on `appointment:{appointmentId}`. */
export function useAppointmentRealtime(
  appointmentId: string | null | undefined,
  onUpdated: (payload: unknown) => void,
) {
  const callbackRef = useRef(onUpdated);
  callbackRef.current = onUpdated;

  useEffect(() => {
    if (!appointmentId) return;

    const channel = supabase
      .channel(`appointment:${appointmentId}`, {
        config: { broadcast: { self: true } },
      })
      .on("broadcast", { event: "appointment_updated" }, ({ payload }) => {
        callbackRef.current(payload);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            `[realtime] appointment:${appointmentId} subscription error`,
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appointmentId]);
}
