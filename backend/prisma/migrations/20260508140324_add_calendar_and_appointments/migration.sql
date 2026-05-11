-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REFUSED', 'RESCHEDULED', 'CANCELLED_CLIENT', 'CANCELLED_PROVIDER', 'EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AppointmentConfirmationType" AS ENUM ('START', 'END');

-- CreateTable
CREATE TABLE "provider_availability" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "is_working" BOOLEAN NOT NULL DEFAULT true,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_days_off" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_days_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "given_service_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_date" DATE NOT NULL,
    "scheduled_time" TEXT NOT NULL,
    "notes" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refusal_reason" TEXT,
    "reschedule_date" DATE,
    "reschedule_time" TEXT,
    "en_route_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "before_photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "after_photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_confirmations" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "confirmed_by" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "type" "AppointmentConfirmationType" NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_availability_provider_id_idx" ON "provider_availability"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_availability_provider_id_day_of_week_key" ON "provider_availability"("provider_id", "day_of_week");

-- CreateIndex
CREATE INDEX "provider_days_off_provider_id_date_idx" ON "provider_days_off"("provider_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "provider_days_off_provider_id_date_key" ON "provider_days_off"("provider_id", "date");

-- CreateIndex
CREATE INDEX "appointments_client_id_status_idx" ON "appointments"("client_id", "status");

-- CreateIndex
CREATE INDEX "appointments_provider_id_scheduled_date_idx" ON "appointments"("provider_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "appointments_given_service_id_idx" ON "appointments"("given_service_id");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointment_confirmations_appointment_id_idx" ON "appointment_confirmations"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_confirmations_appointment_id_role_type_key" ON "appointment_confirmations"("appointment_id", "role", "type");

-- AddForeignKey
ALTER TABLE "provider_availability" ADD CONSTRAINT "provider_availability_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_days_off" ADD CONSTRAINT "provider_days_off_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_given_service_id_fkey" FOREIGN KEY ("given_service_id") REFERENCES "given_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_confirmations" ADD CONSTRAINT "appointment_confirmations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
