import { supabase } from '../lib/supabase'

const BUCKET = 'service_photos'

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function safeExt(fileName: string, mime: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase()
  if (fromName && ALLOWED_EXT.has(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg'
}

/**
 * Upload a catalog service image. Objects are stored as:
 * `service_photos/{folderKey}/{timestamp}-{rand}.{ext}`
 * Use `service.id` when editing, or a stable UUID per “create” modal session for new services.
 */
export async function uploadServiceCatalogPhoto(
  file: File,
  options: { folderKey: string },
): Promise<string> {
  const ext = safeExt(file.name, file.type || '')
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const path = `${options.folderKey}/${unique}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
