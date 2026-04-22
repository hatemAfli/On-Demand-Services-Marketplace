/**
 * Uploads provider verification files to Supabase Storage bucket `provider-documents`.
 * Supports images (compressed/resized) and other files (PDF, Office, etc.) as raw bytes.
 */
import { File as ExpoFile } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

export const PROVIDER_DOCUMENTS_BUCKET = "provider-documents";

type ImageKind = "jpeg" | "png" | "webp";

function resolveImageKind(
  mimeType: string | null | undefined,
  uri: string,
): ImageKind {
  const m = (mimeType ?? "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpeg";
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

function buildUniqueFileName(ext: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}.${ext}`;
}

/** Object key: `{userId}/{timestamp-rand}.{ext}` inside bucket `provider-documents`. */
export function providerDocStoragePath(userId: string, ext: string): string {
  return `${userId}/${buildUniqueFileName(ext)}`;
}

async function readLocalFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const file = new ExpoFile(uri);
  return file.arrayBuffer();
}

export type UploadProviderDocOptions = {
  mimeType?: string | null;
  /** Original file name from document picker (helps infer extension / type). */
  fileName?: string | null;
};

/** True when we should run image pipeline (resize + compress). */
export function isImageMimeOrPath(
  mimeType: string | null | undefined,
  uri: string,
): boolean {
  const m = (mimeType ?? "").toLowerCase();
  if (m.startsWith("image/")) return true;
  const path = uri.split("?")[0]?.toLowerCase() ?? "";
  return /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(path);
}

function sanitizeExt(raw: string | undefined): string {
  const e = (raw ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e.length > 0 ? e : "bin";
}

function extFromFileName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const base = name.split("/").pop() ?? name;
  const parts = base.split(".");
  if (parts.length < 2) return null;
  return sanitizeExt(parts[parts.length - 1]);
}

function extFromUri(uri: string): string {
  const path = uri.split("?")[0] ?? "";
  const seg = path.split("/").pop() ?? "";
  const dot = seg.lastIndexOf(".");
  if (dot === -1) return "bin";
  return sanitizeExt(seg.slice(dot + 1));
}

function inferBinaryContentType(
  mimeType: string | null | undefined,
  uri: string,
  fileName: string | null | undefined,
): { ext: string; contentType: string } {
  const m = (mimeType ?? "").toLowerCase().trim();
  if (m.includes("pdf")) {
    return { ext: "pdf", contentType: "application/pdf" };
  }
  if (
    m.includes("wordprocessingml") ||
    m === "application/msword" ||
    m.includes("msword")
  ) {
    return {
      ext: m.includes("openxml") ? "docx" : "doc",
      contentType: m || "application/msword",
    };
  }
  if (m.includes("spreadsheetml") || m.includes("ms-excel")) {
    return {
      ext: m.includes("openxml") ? "xlsx" : "xls",
      contentType: m || "application/vnd.ms-excel",
    };
  }

  const fromName = extFromFileName(fileName);
  if (fromName) {
    return {
      ext: fromName,
      contentType: m || "application/octet-stream",
    };
  }

  const ext = extFromUri(uri);
  return {
    ext,
    contentType: m || "application/octet-stream",
  };
}

/**
 * Upload verification file; images are resized (max width 1600). PDFs and other files are uploaded as-is.
 */
export async function uploadProviderVerificationDocument(
  userId: string,
  localUri: string,
  options?: UploadProviderDocOptions,
): Promise<string> {
  const isImage = isImageMimeOrPath(options?.mimeType, localUri);

  if (isImage) {
    const kind = resolveImageKind(options?.mimeType, localUri);
    const format = kindToSaveFormat(kind);
    const ext = kindToFileExt(kind);
    const contentType = kindToContentType(kind);

    const manipulated = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1600 } }],
      {
        compress: kind === "png" ? 1 : 0.82,
        format,
      },
    );

    const path = providerDocStoragePath(userId, ext);
    const arrayBuffer = await readLocalFileAsArrayBuffer(manipulated.uri);

    const { error } = await supabase.storage
      .from(PROVIDER_DOCUMENTS_BUCKET)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage
      .from(PROVIDER_DOCUMENTS_BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  }

  const { ext, contentType } = inferBinaryContentType(
    options?.mimeType,
    localUri,
    options?.fileName,
  );
  const path = providerDocStoragePath(userId, ext);
  const arrayBuffer = await readLocalFileAsArrayBuffer(localUri);

  const { error } = await supabase.storage
    .from(PROVIDER_DOCUMENTS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from(PROVIDER_DOCUMENTS_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}
