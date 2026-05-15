/**
 * Provider before/after intervention photos (service execution).
 * Bucket: appointment-intervention-photos (public read for admin / company / client UIs).
 *
 * Path: providers/{providerId}/appointments/{appointmentId}/before|after/{file}
 */
import { File as ExpoFile } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

export const APPOINTMENT_INTERVENTION_PHOTOS_BUCKET =
  "appointment-intervention-photos";

export type InterventionPhotoPhase = "before" | "after";

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

function uniqueFileName(ext: string): string {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}.${ext}`;
}

async function readAsBuffer(uri: string): Promise<ArrayBuffer> {
  const file = new ExpoFile(uri);
  return file.arrayBuffer();
}

export function appointmentInterventionPhotoStoragePath(
  providerId: string,
  appointmentId: string,
  phase: InterventionPhotoPhase,
  ext: string,
): string {
  return `providers/${providerId}/appointments/${appointmentId}/${phase}/${uniqueFileName(ext)}`;
}

export async function uploadAppointmentInterventionPhoto(
  providerId: string,
  appointmentId: string,
  phase: InterventionPhotoPhase,
  localUri: string,
  mimeType?: string | null,
): Promise<string> {
  const imageKind = resolveImageKind(mimeType, localUri);
  const format = kindToSaveFormat(imageKind);
  const ext = kindToFileExt(imageKind);
  const contentType = kindToContentType(imageKind);

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1800 } }],
    { compress: imageKind === "png" ? 1 : 0.82, format },
  );

  const objectPath = appointmentInterventionPhotoStoragePath(
    providerId,
    appointmentId,
    phase,
    ext,
  );
  const bytes = await readAsBuffer(manipulated.uri);
  const { error } = await supabase.storage
    .from(APPOINTMENT_INTERVENTION_PHOTOS_BUCKET)
    .upload(objectPath, bytes, {
      contentType,
      upsert: false,
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(APPOINTMENT_INTERVENTION_PHOTOS_BUCKET)
    .getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function uploadAppointmentInterventionPhotos(
  providerId: string,
  appointmentId: string,
  phase: InterventionPhotoPhase,
  localUris: string[],
): Promise<string[]> {
  const urls: string[] = [];
  for (const uri of localUris) {
    urls.push(
      await uploadAppointmentInterventionPhoto(
        providerId,
        appointmentId,
        phase,
        uri,
      ),
    );
  }
  return urls;
}
