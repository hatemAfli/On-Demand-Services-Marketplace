-- CreateEnum
CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "chatbot_sessions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "ChatbotMessageRole" NOT NULL,
    "text" TEXT NOT NULL,
    "providers" JSONB NOT NULL DEFAULT '[]',
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "intent_detected" BOOLEAN,
    "latency_ms" INTEGER,
    "error_code" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatbot_sessions_client_id_updated_at_idx" ON "chatbot_sessions"("client_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "chatbot_sessions_deleted_at_idx" ON "chatbot_sessions"("deleted_at");

-- CreateIndex
CREATE INDEX "chatbot_messages_session_id_created_at_idx" ON "chatbot_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "chatbot_messages_fallback_created_at_idx" ON "chatbot_messages"("fallback", "created_at");

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chatbot_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
