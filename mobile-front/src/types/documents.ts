/** Mirrors `DocumentType` in Prisma / backend. */
export const PROVIDER_DOCUMENT_TYPES = [
  "IDENTITY",
  "LICENSE",
  "QUALIFICATION",
  "INSURANCE",
  "OTHER",
] as const;

export type ProviderDocumentType = (typeof PROVIDER_DOCUMENT_TYPES)[number];
