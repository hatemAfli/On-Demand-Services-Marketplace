/*
  Warnings:

  - You are about to drop the column `averageRating` on the `providers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "given_services" ADD COLUMN     "advance_booking_required_hours" INTEGER,
ADD COLUMN     "average_rating" DECIMAL(3,2),
ADD COLUMN     "client_must_provide" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "estimated_duration_minutes" INTEGER,
ADD COLUMN     "is_available_immediately" BOOLEAN,
ADD COLUMN     "minimum_hours" INTEGER,
ADD COLUMN     "service_area_notes" TEXT,
ADD COLUMN     "service_radius_km" DOUBLE PRECISION,
ADD COLUMN     "tools_provided_by_provider" BOOLEAN,
ADD COLUMN     "total_completed_jobs" INTEGER,
ADD COLUMN     "total_reviews" INTEGER,
ADD COLUMN     "what_is_included" TEXT,
ADD COLUMN     "what_is_not_included" TEXT;

-- AlterTable
ALTER TABLE "providers" DROP COLUMN "averageRating",
ADD COLUMN     "payment_methods_accepted" TEXT[] DEFAULT ARRAY['Cash']::TEXT[];
