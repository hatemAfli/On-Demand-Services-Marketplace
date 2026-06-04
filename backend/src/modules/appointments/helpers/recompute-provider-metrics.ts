import {
  AppointmentStatus,
  Prisma,
  PrismaClient,
  ProviderType,
} from '@prisma/client';
import { recomputeProviderTopProviderStatus } from './top-provider-status';

type DbClient = Prisma.TransactionClient | PrismaClient;

/** Direct bookings for an independent provider (excludes company-managed requests). */
function independentAppointmentWhere(providerId: string) {
  return {
    providerId,
    companyId: null,
  } as const;
}

async function isIndependentProvider(
  tx: DbClient,
  providerId: string,
): Promise<boolean> {
  const provider = await tx.provider.findUnique({
    where: { id: providerId },
    select: { type: true, companyId: true },
  });
  return (
    provider?.type === ProviderType.INDEPENDENT && provider.companyId === null
  );
}

/**
 * cancellation_rate (%) = provider-cancelled appointments / all direct appointments
 */
export async function recomputeIndependentProviderCancellationRate(
  tx: DbClient,
  providerId: string,
): Promise<void> {
  if (!(await isIndependentProvider(tx, providerId))) return;

  const scope = independentAppointmentWhere(providerId);
  const [cancelledByProviderCount, totalAppointmentsCount] = await Promise.all([
    tx.appointment.count({
      where: {
        ...scope,
        status: AppointmentStatus.CANCELLED_PROVIDER,
        cancelledBy: 'PROVIDER',
      },
    }),
    tx.appointment.count({ where: scope }),
  ]);

  const cancellationRate =
    totalAppointmentsCount > 0
      ? (cancelledByProviderCount / totalAppointmentsCount) * 100
      : 0;

  await tx.provider.update({
    where: { id: providerId },
    data: {
      cancellationRate: new Prisma.Decimal(cancellationRate.toFixed(2)),
    },
  });
}

/**
 * average_response_time (minutes) =
 *   sum(providerRespondedAt - createdAt) / count(responded direct appointments)
 */
export async function recomputeIndependentProviderAverageResponseTime(
  tx: DbClient,
  providerId: string,
): Promise<void> {
  if (!(await isIndependentProvider(tx, providerId))) return;

  const responded = await tx.appointment.findMany({
    where: {
      ...independentAppointmentWhere(providerId),
      providerRespondedAt: { not: null },
    },
    select: {
      createdAt: true,
      providerRespondedAt: true,
    },
  });

  const averageResponseTime =
    responded.length > 0
      ? responded.reduce((sum, row) => {
          const minutes =
            (row.providerRespondedAt!.getTime() - row.createdAt.getTime()) /
            60000;
          return sum + Math.max(0, minutes);
        }, 0) / responded.length
      : null;

  await tx.provider.update({
    where: { id: providerId },
    data: {
      averageResponseTime:
        averageResponseTime !== null
          ? new Prisma.Decimal(averageResponseTime.toFixed(2))
          : null,
    },
  });
}

export async function recomputeIndependentProviderMetrics(
  tx: DbClient,
  providerId: string,
): Promise<void> {
  await recomputeIndependentProviderCancellationRate(tx, providerId);
  await recomputeIndependentProviderAverageResponseTime(tx, providerId);
  await recomputeProviderTopProviderStatus(tx, providerId);
}

/** Recompute metrics for every independent provider (backfill / maintenance). */
export async function recomputeAllIndependentProviderMetrics(
  tx: DbClient,
): Promise<number> {
  const providers = await tx.provider.findMany({
    where: { type: ProviderType.INDEPENDENT, companyId: null },
    select: { id: true },
  });
  for (const { id } of providers) {
    await recomputeIndependentProviderMetrics(tx, id);
  }
  return providers.length;
}
