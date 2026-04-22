export type ServiceCategory = {
  id: string
  name: string
  translations?: {
    en?: { name: string }
    ar?: { name: string }
  }
  slug: string
  iconKey: string | null
  iconUrl: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type CreateServiceCategoryInput = {
  translations: {
    en: { name: string }
    ar?: { name: string }
  }
  slug?: string
  iconKey?: string
  iconUrl?: string
  sortOrder?: number
  active?: boolean
}

export type UpdateServiceCategoryInput = Partial<CreateServiceCategoryInput>
