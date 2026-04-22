-- CreateTable
CREATE TABLE "service_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon_key" TEXT,
    "icon_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_active_sort_order_idx" ON "service_categories"("active", "sort_order");

-- AlterTable
ALTER TABLE "services" ADD COLUMN "category_id" UUID;

-- Default category + backfill existing catalog rows
INSERT INTO "service_categories" ("name", "slug", "sort_order", "active", "created_at", "updated_at")
VALUES ('General', 'general', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "services" SET "category_id" = (
    SELECT "id" FROM "service_categories" WHERE "slug" = 'general' LIMIT 1
);

ALTER TABLE "services" ALTER COLUMN "category_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "services"("category_id");

-- CreateIndex
CREATE INDEX "services_active_category_id_idx" ON "services"("active", "category_id");
