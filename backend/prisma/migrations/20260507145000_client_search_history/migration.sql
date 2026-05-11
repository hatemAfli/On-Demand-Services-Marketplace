-- CreateTable
CREATE TABLE "client_search_history" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "query" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_search_history_client_id_service_id_key" ON "client_search_history"("client_id", "service_id");

-- CreateIndex
CREATE INDEX "client_search_history_client_id_updated_at_idx" ON "client_search_history"("client_id", "updated_at");

-- CreateIndex
CREATE INDEX "client_search_history_service_id_idx" ON "client_search_history"("service_id");

-- AddForeignKey
ALTER TABLE "client_search_history" ADD CONSTRAINT "client_search_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_search_history" ADD CONSTRAINT "client_search_history_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
