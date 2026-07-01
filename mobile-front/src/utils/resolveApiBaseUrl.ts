import Constants from "expo-constants";
import { Platform } from "react-native";

const BACKEND_PORT = 3000;
const API_PATH = "/api";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function hostFromUri(uri: string | undefined): string | null {
  if (!uri) return null;
  const hostPort = uri.split("/")[0];
  const host = hostPort?.split(":")[0];
  return host || null;
}

function resolveDebuggerHost(): string | null {
  const expoGo = Constants.expoGoConfig?.debuggerHost;
  if (expoGo) return expoGo;

  const hostUri = Constants.expoConfig?.hostUri;
  const fromHostUri = hostFromUri(hostUri);
  if (fromHostUri) return fromHostUri;

  const legacy = (
    Constants as { manifest?: { debuggerHost?: string } }
  ).manifest?.debuggerHost;
  return legacy ?? null;
}

/**
 * Resolves the NestJS API base URL for the current runtime.
 *
 * Priority:
 * 1. EXPO_PUBLIC_API_URL when set (skip stale WSL placeholders)
 * 2. Same LAN host as the Metro bundler (Expo Go / physical device)
 * 3. Android emulator → 10.0.2.2 (host loopback)
 * 4. iOS simulator / default → localhost
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv && !fromEnv.includes("172.28.224.32")) {
    return normalizeBaseUrl(fromEnv);
  }

  const debuggerHost = resolveDebuggerHost();
  if (debuggerHost) {
    const host = debuggerHost.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:${BACKEND_PORT}${API_PATH}`;
    }
  }

  if (Platform.OS === "android") {
    return `http://10.0.2.2:${BACKEND_PORT}${API_PATH}`;
  }

  return `http://localhost:${BACKEND_PORT}${API_PATH}`;
}
