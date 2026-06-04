import { Prisma, ReviewVisibility } from '@prisma/client';
import { recomputeProviderTopProviderStatus } from '../../appointments/helpers/top-provider-status';
import { recomputeCompanyRating } from './recompute-company-rating';

/** Recompute provider, given-service, and company ratings after review CRUD. */
export async function recomputeReviewAggregates(
  tx: Prisma.TransactionClient,
  providerId: string,
  givenServiceId: string,
): Promise<void> {
  const publicWhere = { visibility: ReviewVisibility.PUBLIC } as const;

  const providerRatings = await tx.review.findMany({
    where: { providerId, ...publicWhere },
    select: { rating: true },
  });
  const providerTotal = providerRatings.length;
  const providerAvg =
    providerTotal === 0
      ? 0
      : providerRatings.reduce((s, r) => s + r.rating, 0) / providerTotal;

  await tx.provider.update({
    where: { id: providerId },
    data: {
      averageRating: new Prisma.Decimal(providerAvg.toFixed(2)),
      totalReviews: providerTotal,
    },
  });
  await recomputeProviderTopProviderStatus(tx, providerId);

  const serviceRatings = await tx.review.findMany({
    where: { givenServiceId, ...publicWhere },
    select: { rating: true },
  });
  const serviceTotal = serviceRatings.length;
  const serviceAvg =
    serviceTotal === 0
      ? 0
      : serviceRatings.reduce((s, r) => s + r.rating, 0) / serviceTotal;

  await tx.givenService.update({
    where: { id: givenServiceId },
    data: {
      averageRating: new Prisma.Decimal(serviceAvg.toFixed(2)),
      totalReviews: serviceTotal,
    },
  });

  const provider = await tx.provider.findUnique({
    where: { id: providerId },
    select: { companyId: true },
  });
  if (provider?.companyId) {
    await recomputeCompanyRating(tx, provider.companyId);
  }
}
