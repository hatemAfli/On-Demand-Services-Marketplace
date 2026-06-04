import { OwnerType, Prisma, PrismaClient } from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Composite performance score (0–100). Badge is granted at {@link TOP_PROVIDER_SCORE_THRESHOLD}.
 *
 * | Component        | Max pts | Formula                                      |
 * |------------------|---------|----------------------------------------------|
 * | Rating           | 35      | (averageRating / 5) × 35                     |
 * | Review trust     | 15      | min(totalReviews / 12, 1) × 15               |
 * | Completed jobs   | 25      | min(totalCompletedJobs / 40, 1) × 25         |
 * | Response speed   | 15      | max(0, 1 − avgResponseMin / 180) × 15        |
 * | Low cancellation | 10      | max(0, 1 − cancellationRate% / 20) × 10      |
 *
 * Minimum gates (all required in addition to score):
 * - averageRating ≥ 4.2
 * - totalReviews ≥ 5
 * - totalCompletedJobs ≥ 5
 * - cancellationRate ≤ 15%
 * - averageResponseTime ≤ 120 min when known
 */
export const TOP_PROVIDER_SCORE_THRESHOLD = 72;

export type ProviderPerformanceSnapshot = {
  averageRating: number;
  totalReviews: number;
  cancellationRate: number;
  averageResponseTime: number | null;
  totalCompletedJobs: number;
};

export function computeTopProviderScore(
  snapshot: ProviderPerformanceSnapshot,
): number {
  const rating = (snapshot.averageRating / 5) * 35;
  const reviews = Math.min(snapshot.totalReviews / 12, 1) * 15;
  const jobs = Math.min(snapshot.totalCompletedJobs / 40, 1) * 25;
  const response =
    snapshot.averageResponseTime !== null
      ? Math.max(0, 1 - snapshot.averageResponseTime / 180) * 15
      : 7.5;
  const cancellation =
    Math.max(0, 1 - snapshot.cancellationRate / 20) * 10;

  return Math.round((rating + reviews + jobs + response + cancellation) * 100) /
    100;
}

export function qualifiesAsTopProvider(
  snapshot: ProviderPerformanceSnapshot,
): boolean {
  const score = computeTopProviderScore(snapshot);
  return (
    score >= TOP_PROVIDER_SCORE_THRESHOLD &&
    snapshot.averageRating >= 4.2 &&
    snapshot.totalReviews >= 5 &&
    snapshot.totalCompletedJobs >= 5 &&
    snapshot.cancellationRate <= 15 &&
    (snapshot.averageResponseTime === null ||
      snapshot.averageResponseTime <= 120)
  );
}

export async function loadProviderPerformanceSnapshot(
  tx: DbClient,
  providerId: string,
): Promise<ProviderPerformanceSnapshot | null> {
  const provider = await tx.provider.findUnique({
    where: { id: providerId },
    select: {
      averageRating: true,
      totalReviews: true,
      cancellationRate: true,
      averageResponseTime: true,
    },
  });
  if (!provider) return null;

  const jobsAgg = await tx.givenService.aggregate({
    where: {
      ownerType: OwnerType.PROVIDER,
      ownerId: providerId,
    },
    _sum: { totalCompletedJobs: true },
  });

  return {
    averageRating: Number(provider.averageRating ?? 0),
    totalReviews: provider.totalReviews ?? 0,
    cancellationRate: Number(provider.cancellationRate ?? 0),
    averageResponseTime:
      provider.averageResponseTime !== null &&
      provider.averageResponseTime !== undefined
        ? Number(provider.averageResponseTime)
        : null,
    totalCompletedJobs: jobsAgg._sum.totalCompletedJobs ?? 0,
  };
}

/** Recompute and persist `Provider.isTopProvider` from current performance data. */
export async function recomputeProviderTopProviderStatus(
  tx: DbClient,
  providerId: string,
): Promise<boolean> {
  const snapshot = await loadProviderPerformanceSnapshot(tx, providerId);
  if (!snapshot) return false;

  const isTopProvider = qualifiesAsTopProvider(snapshot);

  await tx.provider.update({
    where: { id: providerId },
    data: { isTopProvider },
  });

  return isTopProvider;
}
