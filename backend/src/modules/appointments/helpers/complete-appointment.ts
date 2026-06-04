import {
  AppointmentConfirmationType,
  AppointmentStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { incrementGivenServiceCompletedJobs } from './increment-given-service-completed-jobs';
import { recomputeProviderTopProviderStatus } from './top-provider-status';

type DbClient = Prisma.TransactionClient | PrismaClient;

type AppointmentWithConfirmations = {
  id: string;
  clientId: string;
  givenServiceId: string;
  providerId: string | null;
  status: AppointmentStatus;
  startedAt: Date | null;
  confirmations: Array<{
    role: string;
    type: AppointmentConfirmationType;
  }>;
};

export function hasProviderEndConfirmation(
  confirmations: AppointmentWithConfirmations['confirmations'],
): boolean {
  return confirmations.some(
    (c) =>
      c.role === 'PROVIDER' && c.type === AppointmentConfirmationType.END,
  );
}

/**
 * Marks appointment COMPLETED and increments linked GivenService job counters.
 * Returns null when completion preconditions are not met.
 */
export async function finalizeAppointmentCompletion(
  tx: DbClient,
  appointment: AppointmentWithConfirmations,
): Promise<{
  appointment: {
    id: string;
    status: AppointmentStatus;
    completedAt: Date;
    durationMinutes: number;
  };
  incrementedGivenServiceIds: string[];
} | null> {
  if (appointment.status === AppointmentStatus.COMPLETED) {
    return null;
  }

  if (!hasProviderEndConfirmation(appointment.confirmations)) {
    return null;
  }

  const now = new Date();
  const startedAt = appointment.startedAt ?? now;
  const durationMinutes = Math.max(
    0,
    Math.round((now.getTime() - startedAt.getTime()) / 60000),
  );

  const incrementedGivenServiceIds = await incrementGivenServiceCompletedJobs(
    tx,
    {
      givenServiceId: appointment.givenServiceId,
      providerId: appointment.providerId,
      status: appointment.status,
    },
  );

  if (incrementedGivenServiceIds.length === 0) {
    return null;
  }

  const updatedAppointment = await tx.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.COMPLETED,
      completedAt: now,
      durationMinutes,
      completedJobsCounted: true,
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
      durationMinutes: true,
    },
  });

  if (appointment.providerId) {
    await recomputeProviderTopProviderStatus(tx, appointment.providerId);
  }

  return {
    appointment: {
      id: updatedAppointment.id,
      status: updatedAppointment.status,
      completedAt: updatedAppointment.completedAt!,
      durationMinutes: updatedAppointment.durationMinutes ?? durationMinutes,
    },
    incrementedGivenServiceIds,
  };
}

/**
 * Repairs appointments marked COMPLETED before job counters were incremented.
 */
export async function backfillCompletedJobsCount(
  tx: DbClient,
  appointment: {
    id: string;
    givenServiceId: string;
    providerId: string | null;
    completedJobsCounted: boolean;
    status: AppointmentStatus;
  },
): Promise<string[]> {
  if (appointment.completedJobsCounted) {
    return [];
  }

  const incrementedGivenServiceIds = await incrementGivenServiceCompletedJobs(
    tx,
    {
      givenServiceId: appointment.givenServiceId,
      providerId: appointment.providerId,
      status: appointment.status,
    },
    { allowWhenAlreadyCompleted: true },
  );

  if (incrementedGivenServiceIds.length === 0) {
    return [];
  }

  await tx.appointment.update({
    where: { id: appointment.id },
    data: { completedJobsCounted: true },
  });

  if (appointment.providerId) {
    await recomputeProviderTopProviderStatus(tx, appointment.providerId);
  }

  return incrementedGivenServiceIds;
}
