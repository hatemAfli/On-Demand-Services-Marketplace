/** Single line for header + “Popular near …” (city • street from client profile). */
export function clientLocationLine(
  city?: string | null,
  address?: string | null,
): string {
  return [city?.trim(), address?.trim()].filter(Boolean).join(" • ");
}
