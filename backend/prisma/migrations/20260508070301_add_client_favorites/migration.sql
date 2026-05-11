-- CreateEnum
CREATE TYPE "FavoriteType" AS ENUM ('CATEGORY', 'SERVICE', 'PROVIDER');

-- CreateTable
CREATE TABLE "client_favorites" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "type" "FavoriteType" NOT NULL,
    "category_id" UUID,
    "service_id" UUID,
    "provider_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_favorites_client_id_type_created_at_idx" ON "client_favorites"("client_id", "type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "client_favorites_client_id_category_id_key" ON "client_favorites"("client_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_favorites_client_id_service_id_key" ON "client_favorites"("client_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_favorites_client_id_provider_id_key" ON "client_favorites"("client_id", "provider_id");

-- AddForeignKey
ALTER TABLE "client_favorites" ADD CONSTRAINT "client_favorites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_favorites" ADD CONSTRAINT "client_favorites_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_favorites" ADD CONSTRAINT "client_favorites_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_favorites" ADD CONSTRAINT "client_favorites_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
