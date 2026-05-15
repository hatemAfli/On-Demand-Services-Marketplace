-- CreateEnum
CREATE TYPE "ReviewVisibility" AS ENUM ('PUBLIC', 'HIDDEN');

-- AlterTable
ALTER TABLE "providers" ADD COLUMN "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "given_service_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "provider_reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "visibility" "ReviewVisibility" NOT NULL DEFAULT 'PUBLIC',
    "hidden_reason" TEXT,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_appointment_id_key" ON "reviews"("appointment_id");

-- CreateIndex
CREATE INDEX "reviews_provider_id_created_at_idx" ON "reviews"("provider_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_given_service_id_created_at_idx" ON "reviews"("given_service_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_client_id_idx" ON "reviews"("client_id");

-- CreateIndex
CREATE INDEX "reviews_visibility_provider_id_idx" ON "reviews"("visibility", "provider_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_given_service_id_fkey" FOREIGN KEY ("given_service_id") REFERENCES "given_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
