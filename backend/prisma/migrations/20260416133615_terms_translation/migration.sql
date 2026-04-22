/*
  Warnings:

  - You are about to drop the column `content_markdown` on the `legal_document_versions` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `legal_document_versions` table. All the data in the column will be lost.
  - You are about to drop the column `locale` on the `legal_documents` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `legal_documents` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[type]` on the table `legal_documents` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "legal_documents_locale_type_idx";

-- DropIndex
DROP INDEX "legal_documents_type_locale_key";

-- AlterTable
ALTER TABLE "legal_document_versions" DROP COLUMN "content_markdown",
DROP COLUMN "summary";

-- AlterTable
ALTER TABLE "legal_documents" DROP COLUMN "locale",
DROP COLUMN "title";

-- CreateTable
CREATE TABLE "legal_document_translations" (
    "id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_document_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_document_translations_document_version_id_idx" ON "legal_document_translations"("document_version_id");

-- CreateIndex
CREATE INDEX "legal_document_translations_locale_idx" ON "legal_document_translations"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "legal_document_translations_document_version_id_locale_key" ON "legal_document_translations"("document_version_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_key" ON "legal_documents"("type");

-- AddForeignKey
ALTER TABLE "legal_document_translations" ADD CONSTRAINT "legal_document_translations_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "legal_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
