-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPOINTMENT_NEW_REQUEST', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REFUSED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_RESCHEDULE_ACCEPTED', 'APPOINTMENT_RESCHEDULE_DECLINED', 'APPOINTMENT_CANCELLED_CLIENT', 'APPOINTMENT_CANCELLED_PROVIDER', 'APPOINTMENT_REMINDER_24H', 'APPOINTMENT_REMINDER_1H', 'APPOINTMENT_EN_ROUTE', 'APPOINTMENT_STARTED', 'APPOINTMENT_COMPLETED', 'ACCOUNT_VERIFIED', 'ACCOUNT_REJECTED', 'DOCUMENT_ACCEPTED', 'DOCUMENT_REJECTED', 'NEW_REVIEW', 'SYSTEM_ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_user_id_token_key" ON "push_tokens"("user_id", "token");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
