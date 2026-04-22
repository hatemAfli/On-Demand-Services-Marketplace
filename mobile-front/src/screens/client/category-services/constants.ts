/** Temporary hero images until `Service` has an `imageUrl` field. */
export const SERVICE_PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80",
  "https://images.unsplash.com/photo-1563453398592-28b48bafe6e6?w=400&q=80",
  "https://images.unsplash.com/photo-1628177142898-93e36e76e703?w=400&q=80",
  "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=400&q=80",
  "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=400&q=80",
] as const;

export function placeholderImageForService(index: number): string {
  return SERVICE_PLACEHOLDER_IMAGES[index % SERVICE_PLACEHOLDER_IMAGES.length];
}
