-- Create locale enum for translatable catalog content
CREATE TYPE "Locale" AS ENUM ('EN', 'AR');

-- Category translations
CREATE TABLE "service_category_translations" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_category_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_category_translations_category_id_locale_key"
ON "service_category_translations"("category_id", "locale");

CREATE INDEX "service_category_translations_locale_name_idx"
ON "service_category_translations"("locale", "name");

ALTER TABLE "service_category_translations"
ADD CONSTRAINT "service_category_translations_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "service_categories"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Service translations
CREATE TABLE "service_translations" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_translations_service_id_locale_key"
ON "service_translations"("service_id", "locale");

CREATE INDEX "service_translations_locale_name_idx"
ON "service_translations"("locale", "name");

ALTER TABLE "service_translations"
ADD CONSTRAINT "service_translations_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill EN translations from current canonical fields
INSERT INTO "service_category_translations" ("id", "category_id", "locale", "name", "created_at", "updated_at")
SELECT gen_random_uuid(), sc."id", 'EN'::"Locale", sc."name", NOW(), NOW()
FROM "service_categories" sc
ON CONFLICT ("category_id", "locale") DO NOTHING;

INSERT INTO "service_translations" ("id", "service_id", "locale", "name", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), s."id", 'EN'::"Locale", s."name", s."description", NOW(), NOW()
FROM "services" s
ON CONFLICT ("service_id", "locale") DO NOTHING;
