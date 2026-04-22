import type { ServiceCategory } from './service-category'

export type AdminService = {
  id: string
  name: string
  description: string | null
  /** Public image URL (Supabase Storage `service_photos` bucket). */
  servicePhoto: string | null
  translations?: {
    en?: { name: string; description: string | null }
    ar?: { name: string; description: string | null }
  }
  categoryId: string
  active: boolean
  createdAt: string
  updatedAt: string
  category: Pick<
    ServiceCategory,
    'id' | 'name' | 'translations' | 'slug' | 'iconKey' | 'iconUrl'
  >
}

export type CreateAdminServiceInput = {
  translations: {
    en: { name: string; description?: string }
    ar?: { name: string; description?: string }
  }
  categoryId: string
  active?: boolean
  servicePhoto?: string
}

/** PATCH body: `servicePhoto: null` clears the image. */
export type UpdateAdminServiceInput = Omit<
  Partial<CreateAdminServiceInput>,
  'servicePhoto'
> & {
  servicePhoto?: string | null
}
