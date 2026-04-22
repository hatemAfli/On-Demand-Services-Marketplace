-- Translation-driven catalog: remove base text columns now that translations are in place.
ALTER TABLE "service_categories"
DROP COLUMN "name";

ALTER TABLE "services"
DROP COLUMN "name",
DROP COLUMN "description";
