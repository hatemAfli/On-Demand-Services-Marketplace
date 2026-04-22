export type LegalDocumentType = 'TERMS' | 'PRIVACY'
export type Locale = 'EN' | 'AR'
export type LegalDocumentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type LegalDocumentTranslation = {
  id: string
  documentVersionId: string
  locale: Locale
  title: string
  contentMarkdown: string
  summary: string | null
  createdAt: string
  updatedAt: string
}

export type LegalDocumentVersion = {
  id: string
  documentId: string
  version: number
  status: LegalDocumentStatus
  publishedAt: string | null
  createdByAdminId: string | null
  createdAt: string
  updatedAt: string
  translations: LegalDocumentTranslation[]
}

export type LegalDocumentAdminItem = {
  id: string
  type: LegalDocumentType
  currentVersion: number
  createdAt: string
  updatedAt: string
  versions: LegalDocumentVersion[]
}

export type CreateLegalDocumentInput = {
  type: LegalDocumentType
  titleEn: string
  contentEn: string
  summaryEn?: string
  titleAr: string
  contentAr: string
  summaryAr?: string
  publish?: boolean
}

export type UpdateLegalDocumentInput = {
  titleEn?: string
  titleAr?: string
}

export type AddLegalDocumentVersionInput = {
  titleEn: string
  contentEn: string
  summaryEn?: string
  titleAr: string
  contentAr: string
  summaryAr?: string
  publish?: boolean
}

export type PatchLegalDocumentVersionInput = {
  titleEn?: string
  contentEn?: string
  summaryEn?: string
  titleAr?: string
  contentAr?: string
  summaryAr?: string
  publish?: boolean
}
