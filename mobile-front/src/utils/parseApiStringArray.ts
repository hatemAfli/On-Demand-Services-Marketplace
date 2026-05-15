/** Normalizes API string arrays (camel/snake case, JSON string, Postgres-like lists). */
export function parseApiStringArray(value: unknown): string[] {
  if (value == null) return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        return parseApiStringArray(JSON.parse(trimmed) as unknown);
      } catch {
        return [trimmed];
      }
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    return [trimmed];
  }

  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

export function pickApiStringArray(
  raw: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): string[] {
  const camel = parseApiStringArray(raw[camelKey]);
  if (camel.length > 0) return camel;
  return parseApiStringArray(raw[snakeKey]);
}

export function unwrapAppointmentApiPayload(
  data: unknown,
): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const top = data as Record<string, unknown>;
  if (typeof top.id === "string") return top;
  const nested = top.data ?? top.appointment;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return top;
}
