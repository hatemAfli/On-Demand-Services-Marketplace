/** Shared slot-picker helpers (client booking + provider reschedule). */

export type SlotPickerItem = {
  time: string;
  status: "available" | "reserved";
};

export type DaysOffByDate = Record<string, string | null>;

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeDayOffApiDate(raw: string): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
}

export function isDateDayOff(map: DaysOffByDate, ymd: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, ymd);
}

export function isSameLocalCalendarDay(ymd: string, ref: Date): boolean {
  return ymd === formatYmd(ref);
}

export function isSlotStartInPast(
  ymd: string,
  slotHHmm: string,
  now: Date,
): boolean {
  if (!isSameLocalCalendarDay(ymd, now)) return false;
  const parts = slotHHmm.trim().split(":");
  if (parts.length < 2) return false;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  const slotStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh,
    mm,
    0,
    0,
  );
  return slotStart.getTime() < now.getTime();
}

export function normalizeSlotsResponse(data: unknown): SlotPickerItem[] {
  if (Array.isArray(data)) {
    return data
      .filter((entry): entry is string => typeof entry === "string")
      .map((time) => ({ time, status: "available" as const }));
  }
  if (data && typeof data === "object" && "slots" in data) {
    const slots = (data as { slots?: unknown }).slots;
    if (!Array.isArray(slots)) return [];
    return slots
      .map((entry) => {
        if (typeof entry === "string") {
          return { time: entry, status: "available" as const };
        }
        if (entry && typeof entry === "object" && "time" in entry) {
          const row = entry as { time?: unknown; status?: unknown };
          const time = typeof row.time === "string" ? row.time : "";
          const status = row.status === "reserved" ? "reserved" : "available";
          return time ? { time, status } : null;
        }
        return null;
      })
      .filter((row): row is SlotPickerItem => row !== null);
  }
  return [];
}
