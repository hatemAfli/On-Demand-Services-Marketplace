-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_adminId_fkey";

-- CreateTable
CREATE TABLE "Hatem" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Hatem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "company_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
