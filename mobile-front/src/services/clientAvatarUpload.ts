/**
 * Uploads client profile photos to Supabase Storage.
 *
 * Uses the modern `File` API from `expo-file-system` (`file.arrayBuffer()`), not deprecated
 * `readAsStringAsync` on the main import.
 *
 * Supports common image types (JPEG, PNG, WebP) based on picker MIME type or file extension.
 */
import { File as ExpoFile } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

const AVATAR_BUCKET = "avatars";

type ImageKind = "jpeg" | "png" | "webp";

function resolveImageKind(
  mimeType: string | null | undefined,
  uri: string,
): ImageKind {
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpeg";
  /** iOS camera roll often uses HEIC; we normalize to JPEG on upload */
  if (m.includes("heic") || m.includes("heif")) return "jpeg";

  const u = uri.split("?")[0]?.toLowerCase() ?? "";
  if (u.endsWith(".png")) return "png";
  if (u.endsWith(".webp")) return "webp";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "jpeg";
  return "jpeg";
}

function kindToSaveFormat(kind: ImageKind): ImageManipulator.SaveFormat {
  switch (kind) {
    case "png":
      return ImageManipulator.SaveFormat.PNG;
    case "webp":
      return ImageManipulator.SaveFormat.WEBP;
    default:
      return ImageManipulator.SaveFormat.JPEG;
  }
}

function kindToFileExt(kind: ImageKind): string {
  switch (kind) {
    case "png":
      return "png";
    case "webp":
      return "webp";
    default:
      return "jpg";
  }
}

function kindToContentType(kind: ImageKind): string {
  switch (kind) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/**
 * Object key: `avatars/{userId}/profile.{ext}` with ext jpg | png | webp
 */
export function clientAvatarStoragePath(userId: string, ext: string): string {
  return `avatars/${userId}/profile.${ext}`;
}

async function readLocalFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const file = new ExpoFile(uri);
  return file.arrayBuffer();
}

export async function requestPhotoLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === "granted";
}

export type UploadAvatarOptions = {
  /** From `ImagePicker` asset `mimeType`, when available */
  mimeType?: string | null;
};

/**
 * Resize (max width 1024), keep format when possible, upload to Storage, return public URL.
 */
export async function uploadClientProfileAvatar(
  userId: string,
  localUri: string,
  options?: UploadAvatarOptions,
): Promise<string> {
  const kind = resolveImageKind(options?.mimeType, localUri);
  const format = kindToSaveFormat(kind);
  const ext = kindToFileExt(kind);
  const contentType = kindToContentType(kind);

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1024 } }],
    {
      compress: kind === "png" ? 1 : 0.85,
      format,
    },
  );

  const path = clientAvatarStoragePath(userId, ext);
  const arrayBuffer = await readLocalFileAsArrayBuffer(manipulated.uri);

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
