-- CreateEnum
CREATE TYPE "FaqAudience" AS ENUM ('ALL', 'CLIENT', 'PROVIDER');

-- CreateEnum
CREATE TYPE "SupportMessageStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "faq_items" (
    "id" UUID NOT NULL,
    "audience" "FaqAudience" NOT NULL DEFAULT 'ALL',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_translations" (
    "id" UUID NOT NULL,
    "faq_item_id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "faq_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportMessageStatus" NOT NULL DEFAULT 'NEW',
    "user_role" "UserRole" NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_items_audience_is_published_sort_order_idx" ON "faq_items"("audience", "is_published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "faq_translations_faq_item_id_locale_key" ON "faq_translations"("faq_item_id", "locale");

-- CreateIndex
CREATE INDEX "support_messages_status_created_at_idx" ON "support_messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_messages_user_id_idx" ON "support_messages"("user_id");

-- AddForeignKey
ALTER TABLE "faq_translations" ADD CONSTRAINT "faq_translations_faq_item_id_fkey" FOREIGN KEY ("faq_item_id") REFERENCES "faq_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
