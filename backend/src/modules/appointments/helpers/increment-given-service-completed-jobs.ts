import {
  AppointmentStatus,
  OwnerType,
  Prisma,
  PrismaClient,
} from '@prisma/client';

type DbClient = Prisma.TransactionClient | PrismaClient;

type AppointmentForIncrement = {
  givenServiceId: string;
  providerId: string | null;
  status: AppointmentStatus;
};

/**
 * Resolves which GivenService row(s) should receive +1 completed job.
 * Always includes the appointment's booking givenServiceId.
 * When the booking is on a company listing, also increments the assigned provider's offering.
 */
export async function resolveGivenServiceIdsForJobIncrement(
  tx: DbClient,
  appointment: Pick<AppointmentForIncrement, 'givenServiceId' | 'providerId'>,
): Promise<string[]> {
  const bookingGiven = await tx.givenService.findUnique({
    where: { id: appointment.givenServiceId },
    select: {
      id: true,
      ownerType: true,
      ownerId: true,
      serviceId: true,
    },
  });
  if (!bookingGiven) {
    return [];
  }

  const targetIds = new Set<string>([appointment.givenServiceId]);

  if (appointment.providerId) {
    const needsProviderOffering =
      bookingGiven.ownerType === OwnerType.COMPANY ||
      (bookingGiven.ownerType === OwnerType.PROVIDER &&
        bookingGiven.ownerId !== appointment.providerId);

    if (needsProviderOffering) {
      const providerGiven = await tx.givenService.findFirst({
        where: {
          ownerType: OwnerType.PROVIDER,
          ownerId: appointment.providerId,
          serviceId: bookingGiven.serviceId,
        },
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (providerGiven) {
        targetIds.add(providerGiven.id);
      }
    }
  }

  return Array.from(targetIds);
}

/**
 * Increments `GivenService.totalCompletedJobs` when an appointment is completed.
 * No-op if the appointment was already COMPLETED (idempotent).
 */
export async function incrementGivenServiceCompletedJobs(
  tx: DbClient,
  appointment: AppointmentForIncrement,
  options?: { allowWhenAlreadyCompleted?: boolean },
): Promise<string[]> {
  if (
    appointment.status === AppointmentStatus.COMPLETED &&
    !options?.allowWhenAlreadyCompleted
  ) {
    return [];
  }

  const targetIds = await resolveGivenServiceIdsForJobIncrement(tx, appointment);
  if (targetIds.length === 0) {
    return [];
  }

  const incremented: string[] = [];

  for (const targetGivenServiceId of targetIds) {
    const row = await tx.givenService.findUnique({
      where: { id: targetGivenServiceId },
      select: { totalCompletedJobs: true },
    });
    if (!row) continue;

    const nextCount = (row.totalCompletedJobs ?? 0) + 1;
    await tx.givenService.update({
      where: { id: targetGivenServiceId },
      data: { totalCompletedJobs: nextCount },
    });
    incremented.push(targetGivenServiceId);
  }

  return incremented;
}
