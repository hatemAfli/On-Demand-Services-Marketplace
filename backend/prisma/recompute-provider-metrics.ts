import { PrismaClient } from '@prisma/client';
import { recomputeAllIndependentProviderMetrics } from '../src/modules/appointments/helpers/recompute-provider-metrics';
import { recomputeProviderTopProviderStatus } from '../src/modules/appointments/helpers/top-provider-status';

const prisma = new PrismaClient();

async function main() {
  const independentCount = await recomputeAllIndependentProviderMetrics(prisma);
  console.log(`Independent metrics refreshed: ${independentCount}`);

  const employees = await prisma.provider.findMany({
    where: { companyId: { not: null } },
    select: { id: true },
  });
  for (let i = 0; i < employees.length; i += 1) {
    const { id } = employees[i];
    await recomputeProviderTopProviderStatus(prisma, id);
    if ((i + 1) % 100 === 0) {
      console.log(`Employee badge refresh progress: ${i + 1}/${employees.length}`);
    }
  }

  console.log(
    `Recomputed metrics and top badge for ${independentCount} independent provider(s); ` +
      `refreshed top badge for ${employees.length} employee provider(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
