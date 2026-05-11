import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";

export type CachedClientCoords = {
  latitude: number;
  longitude: number;
  updatedAt: string;
};

function coordsKey(userId: string): string {
  return `client_coords_v1:${userId}`;
}

export async function getStoredClientCoords(
  userId: string,
): Promise<CachedClientCoords | null> {
  try {
    const raw = await SecureStore.getItemAsync(coordsKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedClientCoords>;
    if (
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }
    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function ensureClientCoordsCached(
  userId: string,
): Promise<CachedClientCoords | null> {
  const existing = await getStoredClientCoords(userId);
  if (existing) {
    return existing;
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return null;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const next: CachedClientCoords = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      updatedAt: new Date().toISOString(),
    };
    await SecureStore.setItemAsync(coordsKey(userId), JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}
