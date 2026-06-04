import { PrismaClient } from '@prisma/client';
import { recomputeCompanyAppointmentMetrics } from '../src/modules/company/appointments/helpers/recompute-company-appointment-metrics';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true },
  });

  for (const company of companies) {
    await prisma.$transaction((tx) =>
      recomputeCompanyAppointmentMetrics(tx, company.id),
    );
  }

  console.log(
    `Recomputed cancellation rate & response time for ${companies.length} company(ies).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
