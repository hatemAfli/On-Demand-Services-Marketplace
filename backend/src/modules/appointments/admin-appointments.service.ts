import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  NotificationType,
  PlatformAuditAction,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import type { PlatformAuditContext } from '../platform-audit/platform-audit.types';
import { GetAdminAppointmentsDto } from './dto/get-admin-appointments.dto';
import { InterveneAppointmentDto } from './dto/intervene-appointment.dto';
import { incrementGivenServiceCompletedJobs } from './helpers/increment-given-service-completed-jobs';
import { recomputeProviderTopProviderStatus } from './helpers/top-provider-status';

const DEFAULT_TAKE = 20;
const DEFAULT_SKIP = 0;
const DEFAULT_SORT = 'recent';

export const ADMIN_APPOINTMENT_INCLUDE = {
  client: {
    select: {
      id: true,
      imageUrl: true,
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  },
  provider: {
    select: {
      id: true,
      photoUrl: true,
      type: true,
      city: true,
      totalComplaints: true,
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  },
  givenService: {
    select: {
      id: true,
      price: true,
      pricingType: true,
      service: {
        select: {
          translations: {
            select: { locale: true, name: true },
          },
        },
      },
    },
  },
  review: {
    select: { id: true, rating: true, comment: true },
  },
  complaints: {
    select: { id: true, status: true, category: true },
  },
} satisfies Prisma.AppointmentInclude;

export type AdminAppointmentPayload = Prisma.AppointmentGetPayload<{
  include: typeof ADMIN_APPOINTMENT_INCLUDE;
}>;

@Injectable()
export class AdminAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: PlatformAuditService,
  ) {}

  async list(dto: GetAdminAppointmentsDto) {
    const take = dto.take ?? DEFAULT_TAKE;
    const skip = dto.skip ?? DEFAULT_SKIP;
    const sort = dto.sort ?? DEFAULT_SORT;
    const where = this.buildWhere(dto);
    const orderBy = this.buildOrderBy(sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        orderBy,
        take,
        skip,
        include: ADMIN_APPOINTMENT_INCLUDE,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const statuses = Object.values(AppointmentStatus);

    const [statusGroups, completedToday, durationAgg] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.appointment.count({
        where: {
          status: AppointmentStatus.COMPLETED,
          completedAt: { gte: todayStart },
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          status: AppointmentStatus.COMPLETED,
          durationMinutes: { not: null },
        },
        _avg: { durationMinutes: true },
      }),
    ]);

    const byStatus = statuses.reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<AppointmentStatus, number>,
    );
    for (const row of statusGroups) {
      byStatus[row.status] = row._count._all;
    }

    const total = statusGroups.reduce((sum, row) => sum + row._count._all, 0);
    const disputedActive = byStatus[AppointmentStatus.DISPUTED] ?? 0;

    return {
      total,
      byStatus,
      completedToday,
      disputedActive,
      averageDurationMinutes:
        durationAgg._avg.durationMinutes != null
          ? Math.round(durationAgg._avg.durationMinutes * 10) / 10
          : 0,
    };
  }

  async getById(id: string): Promise<AdminAppointmentPayload> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: ADMIN_APPOINTMENT_INCLUDE,
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async flagAsDisputed(
    id: string,
    ctx?: PlatformAuditContext,
  ): Promise<AdminAppointmentPayload> {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { include: { user: { select: { id: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found');
    }
    if (existing.status === AppointmentStatus.DISPUTED) {
      return this.getById(id);
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.DISPUTED },
      include: ADMIN_APPOINTMENT_INCLUDE,
    });

    const dateLabel = this.formatScheduledDate(existing.scheduledDate);
    const body = `Your appointment on ${dateLabel} at ${existing.scheduledTime} has been flagged for admin review.`;

    void this.notificationsService.send({
      userId: existing.client.user.id,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Appointment under dispute review',
      body,
      data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
    });
    if (existing.provider) {
      void this.notificationsService.send({
        userId: existing.provider.user.id,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Appointment under dispute review',
        body,
        data: { appointmentId: id, screen: 'ProviderAppointmentDetail' },
      });
    }

    const actor = ctx
      ? await this.audit.actorName(ctx.actorAdminId)
      : 'Admin';
    this.audit.logIf(
      ctx,
      PlatformAuditAction.APPOINTMENT_DISPUTED,
      `${actor} flagged appointment as disputed.`,
      { appointmentId: id },
    );

    return updated;
  }

  async intervene(
    id: string,
    dto: InterveneAppointmentDto,
    ctx?: PlatformAuditContext,
  ): Promise<AdminAppointmentPayload> {
    const existing = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: { include: { user: { select: { id: true } } } },
        provider: { include: { user: { select: { id: true } } } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found');
    }

    const terminalStatuses: AppointmentStatus[] = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED_CLIENT,
      AppointmentStatus.CANCELLED_PROVIDER,
      AppointmentStatus.REFUSED,
    ];
    if (terminalStatuses.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot intervene on appointment with status ${existing.status}`,
      );
    }

    const now = new Date();
    const adminNote = `[Admin ${now.toISOString()}] ${dto.reason.trim()}`;
    const dateLabel = this.formatScheduledDate(existing.scheduledDate);

    if (dto.action === 'FORCE_COMPLETE') {
      const durationMinutes =
        existing.startedAt != null
          ? Math.max(
              1,
              Math.round(
                (now.getTime() - existing.startedAt.getTime()) / 60_000,
              ),
            )
          : existing.durationMinutes;

      const updated = await this.prisma.$transaction(async (tx) => {
        const incremented = await incrementGivenServiceCompletedJobs(tx, {
          givenServiceId: existing.givenServiceId,
          providerId: existing.providerId,
          status: existing.status,
        });
        if (incremented.length === 0) {
          throw new BadRequestException(
            'Could not update completed jobs for this service offering',
          );
        }

        const row = await tx.appointment.update({
          where: { id },
          data: {
            status: AppointmentStatus.COMPLETED,
            completedAt: now,
            durationMinutes: durationMinutes ?? undefined,
            completedJobsCounted: true,
            notes: this.appendAdminNote(existing.notes, adminNote),
          },
          include: ADMIN_APPOINTMENT_INCLUDE,
        });

        if (existing.providerId) {
          await recomputeProviderTopProviderStatus(tx, existing.providerId);
        }

        return row;
      });

      const body = `An administrator completed your appointment on ${dateLabel}. Reason: ${dto.reason.trim()}`;
      void this.notificationsService.send({
        userId: existing.client.user.id,
        type: NotificationType.APPOINTMENT_COMPLETED,
        title: 'Appointment completed by admin',
        body,
        data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
      });
      if (existing.provider) {
        void this.notificationsService.send({
          userId: existing.provider.user.id,
          type: NotificationType.APPOINTMENT_COMPLETED,
          title: 'Appointment completed by admin',
          body: `Your appointment on ${dateLabel} was marked completed by an administrator. Reason: ${dto.reason.trim()}`,
          data: { appointmentId: id, screen: 'ProviderAppointmentDetail' },
        });
      }

      const actor = ctx
        ? await this.audit.actorName(ctx.actorAdminId)
        : 'Admin';
      this.audit.logIf(
        ctx,
        PlatformAuditAction.APPOINTMENT_INTERVENED,
        `${actor} force-completed appointment.`,
        { appointmentId: id, action: dto.action, reason: dto.reason.trim() },
      );

      return updated;
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED_PROVIDER,
        cancelledBy: 'ADMIN',
        cancellationReason: dto.reason.trim(),
        cancelledAt: now,
        notes: this.appendAdminNote(existing.notes, adminNote),
      },
      include: ADMIN_APPOINTMENT_INCLUDE,
    });

    void this.notificationsService.send({
      userId: existing.client.user.id,
      type: NotificationType.APPOINTMENT_CANCELLED_PROVIDER,
      title: 'Appointment cancelled by platform',
      body: `Your appointment on ${dateLabel} was cancelled by an administrator. ${dto.reason.trim()}`,
      data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
    });
    if (existing.provider) {
      void this.notificationsService.send({
        userId: existing.provider.user.id,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: 'Appointment cancelled by platform',
        body: `Your appointment on ${dateLabel} was cancelled by an administrator. ${dto.reason.trim()}`,
        data: { appointmentId: id, screen: 'ProviderAppointmentDetail' },
      });
    }

    const actor = ctx
      ? await this.audit.actorName(ctx.actorAdminId)
      : 'Admin';
    this.audit.logIf(
      ctx,
      PlatformAuditAction.APPOINTMENT_INTERVENED,
      `${actor} force-cancelled appointment.`,
      { appointmentId: id, action: dto.action, reason: dto.reason.trim() },
    );

    return updated;
  }

  private buildWhere(dto: GetAdminAppointmentsDto): Prisma.AppointmentWhereInput {
    const where: Prisma.AppointmentWhereInput = {
      ...(dto.status != null ? { status: dto.status } : {}),
      ...(dto.providerId != null ? { providerId: dto.providerId } : {}),
      ...(dto.clientId != null ? { clientId: dto.clientId } : {}),
    };

    if (dto.from != null || dto.to != null) {
      where.scheduledDate = {};
      if (dto.from != null) {
        where.scheduledDate.gte = new Date(`${dto.from}T00:00:00.000Z`);
      }
      if (dto.to != null) {
        where.scheduledDate.lte = new Date(`${dto.to}T00:00:00.000Z`);
      }
    }

    if (dto.hasComplaints === true) {
      where.complaints = { some: {} };
    }

    if (dto.hasDispute === true) {
      where.status = AppointmentStatus.DISPUTED;
    }

    return where;
  }

  private buildOrderBy(
    sort: string,
  ): Prisma.AppointmentOrderByWithRelationInput {
    switch (sort) {
      case 'oldest':
        return { createdAt: 'asc' };
      case 'scheduled_asc':
        return { scheduledDate: 'asc' };
      case 'scheduled_desc':
        return { scheduledDate: 'desc' };
      case 'recent':
      default:
        return { createdAt: 'desc' };
    }
  }

  private appendAdminNote(
    existing: string | null,
    adminNote: string,
  ): string {
    if (existing?.trim()) {
      return `${existing.trim()}\n\n${adminNote}`;
    }
    return adminNote;
  }

  private formatScheduledDate(value: Date): string {
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  }
}
