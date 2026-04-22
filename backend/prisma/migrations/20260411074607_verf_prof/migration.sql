-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('PROVIDER', 'COMPANY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IDENTITY', 'LICENSE', 'QUALIFICATION', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fichier_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_profil_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "owner_type" "OwnerType" NOT NULL,
    "document_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "request_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "admin_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_profil_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_owner_user_id_idx" ON "documents"("owner_user_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "verification_profil_requests_user_id_idx" ON "verification_profil_requests"("user_id");

-- CreateIndex
CREATE INDEX "verification_profil_requests_document_id_idx" ON "verification_profil_requests"("document_id");

-- CreateIndex
CREATE INDEX "verification_profil_requests_service_id_idx" ON "verification_profil_requests"("service_id");

-- CreateIndex
CREATE INDEX "verification_profil_requests_request_status_idx" ON "verification_profil_requests"("request_status");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_profil_requests" ADD CONSTRAINT "verification_profil_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_profil_requests" ADD CONSTRAINT "verification_profil_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_profil_requests" ADD CONSTRAINT "verification_profil_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
