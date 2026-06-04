import { AppointmentStatus, Prisma } from '@prisma/client';

/**
 * cancellation_rate (%) for company bookings:
 * refused-by-company-admin / all company appointments.
 */
export async function recomputeCompanyCancellationRate(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  const [refusedCount, totalAppointmentsCount] = await Promise.all([
    tx.appointment.count({
      where: {
        companyId,
        status: AppointmentStatus.REFUSED,
      },
    }),
    tx.appointment.count({
      where: {
        companyId,
      },
    }),
  ]);

  const cancellationRate =
    totalAppointmentsCount > 0 ? (refusedCount / totalAppointmentsCount) * 100 : 0;

  await tx.company.update({
    where: { id: companyId },
    data: {
      cancellationRate: new Prisma.Decimal(cancellationRate.toFixed(2)),
    },
  });
}

/**
 * average_response_time (minutes) for company bookings:
 * sum(companyRespondedAt - createdAt) / count(responded company requests).
 */
export async function recomputeCompanyAverageResponseTime(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  const respondedAppointments = await tx.appointment.findMany({
    where: {
      companyId,
      companyRespondedAt: { not: null },
    },
    select: {
      createdAt: true,
      companyRespondedAt: true,
    },
  });

  const averageResponseTime =
    respondedAppointments.length > 0
      ? respondedAppointments.reduce((sum, row) => {
          const minutes =
            (row.companyRespondedAt!.getTime() - row.createdAt.getTime()) / 60000;
          return sum + Math.max(0, minutes);
        }, 0) / respondedAppointments.length
      : null;

  await tx.company.update({
    where: { id: companyId },
    data: {
      averageResponseTime:
        averageResponseTime !== null
          ? new Prisma.Decimal(averageResponseTime.toFixed(2))
          : null,
    },
  });
}

export async function recomputeCompanyAppointmentMetrics(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<void> {
  await recomputeCompanyCancellationRate(tx, companyId);
  await recomputeCompanyAverageResponseTime(tx, companyId);
}
