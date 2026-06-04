import { Prisma, ProviderType } from '@prisma/client';

/**
 * Company score = mean of employee provider averageRating values.
 * totalReviews = sum of employee totalReviews.
 */
export async function recomputeCompanyRating(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  const employees = await tx.provider.findMany({
    where: { companyId, type: ProviderType.EMPLOYEE },
    select: { averageRating: true, totalReviews: true },
  });

  if (employees.length === 0) {
    await tx.company.update({
      where: { id: companyId },
      data: {
        averageRating: new Prisma.Decimal('0'),
        totalReviews: 0,
      },
    });
    return;
  }

  const sumAvg = employees.reduce(
    (s, e) => s + Number(e.averageRating ?? 0),
    0,
  );
  const companyAvg = sumAvg / employees.length;
  const totalReviews = employees.reduce(
    (s, e) => s + (e.totalReviews ?? 0),
    0,
  );

  await tx.company.update({
    where: { id: companyId },
    data: {
      averageRating: new Prisma.Decimal(companyAvg.toFixed(2)),
      totalReviews,
    },
  });
}
