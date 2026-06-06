import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  CompanyAuditAction,
  NotificationType,
  OwnerType,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { AvailabilityService } from '../../availability/availability.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SupabaseRealtimeService } from '../../supabase/supabase-realtime.service';
import { CompanyAuditService } from '../audit/company-audit.service';
import { AssignProviderDto } from './dto/assign-provider.dto';
import { GetRescheduleOptionsDto } from './dto/get-reschedule-options.dto';
import { ListCompanyAppointmentsDto } from './dto/list-company-appointments.dto';
import {
  recomputeCompanyAverageResponseTime,
  recomputeCompanyCancellationRate,
} from './helpers/recompute-company-appointment-metrics';
import {
  CompanyRespondAction,
  RespondCompanyAppointmentDto,
} from './dto/respond-company-appointment.dto';

const COMPANY_APPOINTMENT_INCLUDE = {
  client: { include: { user: true } },
  provider: { include: { user: true } },
  givenService: {
    include: {
      service: {
        include: {
          translations: true,
          category: { include: { translations: true } },
        },
      },
    },
  },
  complaints: { select: { id: true }, take: 1 },
  review: { select: { id: true, rating: true } },
} as const;

@Injectable()
export class CompanyAppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
    private readonly realtime: SupabaseRealtimeService,
    private readonly audit: CompanyAuditService,
  ) {}

  private async resolveCompanyId(companyAdminUserId: string): Promise<string> {
    const admin = await this.prisma.companyAdmin.findUnique({
      where: { id: companyAdminUserId },
      select: { companyId: true },
    });
    if (!admin?.companyId) {
      throw new NotFoundException('Company admin account not found.');
    }
    return admin.companyId;
  }

  // ─── List ───────────────────────────────────────────────────────────────

  async list(companyAdminUserId: string, dto: ListCompanyAppointmentsDto) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const take = dto.take ?? 20;
    const skip = dto.skip ?? 0;

    const where: Prisma.AppointmentWhereInput = {
      companyId,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.assignment === 'UNASSIGNED' ? { providerId: null } : {}),
      ...(dto.assignment === 'ASSIGNED' ? { providerId: { not: null } } : {}),
      ...(dto.from || dto.to
        ? {
            scheduledDate: {
              ...(dto.from ? { gte: new Date(dto.from) } : {}),
              ...(dto.to ? { lte: new Date(dto.to) } : {}),
            },
          }
        : {}),
      ...(dto.search
        ? {
            OR: [
              {
                client: {
                  user: {
                    firstName: { contains: dto.search, mode: 'insensitive' },
                  },
                },
              },
              {
                client: {
                  user: {
                    lastName: { contains: dto.search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: COMPANY_APPOINTMENT_INCLUDE,
        orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
        skip,
        take,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  async getStats(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [grouped, todaysCount, unassignedPending, company] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.appointment.count({
        where: {
          companyId,
          scheduledDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
      this.prisma.appointment.count({
        where: {
          companyId,
          providerId: null,
          status: AppointmentStatus.PENDING,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          cancellationRate: true,
          averageResponseTime: true,
        },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of grouped) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
    }

    return {
      total,
      byStatus,
      todaysOrders: todaysCount,
      pendingAssignment: unassignedPending,
      inProgress: byStatus[AppointmentStatus.IN_PROGRESS] ?? 0,
      cancellationRate: Number(company?.cancellationRate ?? 0),
      averageResponseTime:
        company?.averageResponseTime !== null &&
        company?.averageResponseTime !== undefined
          ? Number(company.averageResponseTime)
          : null,
    };
  }

  // ─── Detail ─────────────────────────────────────────────────────────────

  async getById(companyAdminUserId: string, id: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: COMPANY_APPOINTMENT_INCLUDE,
    });
    if (!appointment || appointment.companyId !== companyId) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  // ─── Respond (accept / refuse / reschedule) ───────────────────────────────

  async respond(
    companyAdminUserId: string,
    id: string,
    dto: RespondCompanyAppointmentDto,
    ipAddress?: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        clientId: true,
        providerId: true,
        status: true,
        scheduledDate: true,
        scheduledTime: true,
      },
    });
    if (!appointment || appointment.companyId !== companyId) {
      throw new NotFoundException('Appointment not found');
    }
    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException(
        'Appointment cannot be responded to in its current status',
      );
    }

    const companyName = await this.resolveCompanyName(companyId);
    const formattedDate = this.formatDate(
      appointment.scheduledDate.toISOString().slice(0, 10),
    );

    const respondedAt = new Date();

    if (dto.action === CompanyRespondAction.CONFIRMED) {
      if (appointment.status !== AppointmentStatus.PENDING) {
        throw new BadRequestException(
          'Only pending orders can be accepted. Wait for the client to respond to a reschedule proposal first.',
        );
      }
      if (!appointment.providerId) {
        throw new BadRequestException(
          'Assign a provider before confirming this appointment',
        );
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.appointment.findUnique({
          where: { id },
          select: { companyRespondedAt: true },
        });
        const row = await tx.appointment.update({
          where: { id },
          data: {
            status: AppointmentStatus.CONFIRMED,
            refusalReason: null,
            confirmedAt: respondedAt,
            companyRespondedAt: existing?.companyRespondedAt ?? respondedAt,
          },
        });
        await recomputeCompanyAverageResponseTime(tx, companyId);
        return row;
      });
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: 'Appointment confirmed ✓',
        body: `${companyName} confirmed your booking for ${formattedDate} at ${appointment.scheduledTime}`,
        data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
      });
      this.notifyProviderAssigned(
        appointment.providerId!,
        companyName,
        formattedDate,
        appointment.scheduledTime,
        id,
      );
      this.broadcast(id);
      await this.logAdminAction(
        companyId,
        companyAdminUserId,
        CompanyAuditAction.APPOINTMENT_CONFIRMED,
        `accepted order ${this.orderRef(id)}.`,
        { appointmentId: id, action: dto.action },
        ipAddress,
      );
      return updated;
    }

    if (dto.action === CompanyRespondAction.REFUSED) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.appointment.findUnique({
          where: { id },
          select: { companyRespondedAt: true },
        });
        const row = await tx.appointment.update({
          where: { id },
          data: {
            status: AppointmentStatus.REFUSED,
            refusalReason: dto.refusalReason?.trim() || null,
            companyRespondedAt: existing?.companyRespondedAt ?? respondedAt,
          },
        });
        await recomputeCompanyCancellationRate(tx, companyId);
        await recomputeCompanyAverageResponseTime(tx, companyId);
        return row;
      });
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_REFUSED,
        title: 'Booking request declined',
        body: `${companyName} could not accept your request. Reason: ${
          dto.refusalReason?.trim() || 'Not specified'
        }`,
        data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
      });
      this.broadcast(id);
      await this.logAdminAction(
        companyId,
        companyAdminUserId,
        CompanyAuditAction.APPOINTMENT_REFUSED,
        `refused order ${this.orderRef(id)}${dto.refusalReason?.trim() ? `: ${dto.refusalReason.trim()}` : '.'}`,
        { appointmentId: id, action: dto.action, refusalReason: dto.refusalReason ?? null },
        ipAddress,
      );
      return updated;
    }

    // RESCHEDULED
    if (!dto.rescheduleDate || !dto.rescheduleTime) {
      throw new BadRequestException(
        'rescheduleDate and rescheduleTime are required for RESCHEDULED',
      );
    }
    const rescheduleDate = dto.rescheduleDate;
    const rescheduleTime = dto.rescheduleTime;
    await this.assertRescheduleSlotAvailable(
      companyId,
      id,
      rescheduleDate,
      rescheduleTime,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findUnique({
        where: { id },
        select: { companyRespondedAt: true },
      });
      const row = await tx.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.RESCHEDULED,
          rescheduleDate: new Date(rescheduleDate),
          rescheduleTime,
          companyRespondedAt: existing?.companyRespondedAt ?? respondedAt,
        },
      });
      await recomputeCompanyAverageResponseTime(tx, companyId);
      return row;
    });
    const formattedReschedule = this.formatDate(rescheduleDate);
    void this.notificationsService.send({
      userId: appointment.clientId,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: 'New time proposed',
      body: `${companyName} proposed a new time: ${formattedReschedule} at ${rescheduleTime}`,
      data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
    });
    this.broadcast(id);
    await this.logAdminAction(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.APPOINTMENT_RESCHEDULED,
      `proposed a new time for order ${this.orderRef(id)}: ${this.formatDate(rescheduleDate)} at ${rescheduleTime}.`,
      {
        appointmentId: id,
        action: dto.action,
        rescheduleDate,
        rescheduleTime,
      },
      ipAddress,
    );
    return updated;
  }

  async assignProvider(
    companyAdminUserId: string,
    id: string,
    dto: AssignProviderDto,
    ipAddress?: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { givenService: { select: { serviceId: true, estimatedDurationMinutes: true } } },
    });
    if (!appointment || appointment.companyId !== companyId) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        appointment.status === AppointmentStatus.RESCHEDULED
          ? 'Wait for the client to accept the new time before assigning a provider'
          : 'This order cannot be assigned in its current status',
      );
    }
    const terminal: AppointmentStatus[] = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED_CLIENT,
      AppointmentStatus.CANCELLED_PROVIDER,
      AppointmentStatus.REFUSED,
    ];
    if (terminal.includes(appointment.status)) {
      throw new BadRequestException(
        'Cannot assign a provider to a finished appointment',
      );
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.providerId },
      select: {
        id: true,
        companyId: true,
        type: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (
      !provider ||
      provider.companyId !== companyId ||
      provider.type !== ProviderType.EMPLOYEE
    ) {
      throw new BadRequestException('Provider is not an employee of this company');
    }

    const { dateStr, scheduledTime } = this.effectiveSlot(appointment);
    const duration = appointment.givenService.estimatedDurationMinutes ?? 60;

    const offersService = await this.prisma.givenService.findFirst({
      where: {
        ownerId: dto.providerId,
        ownerType: OwnerType.PROVIDER,
        serviceId: appointment.givenService.serviceId,
        active: true,
      },
      select: { id: true },
    });
    if (!offersService) {
      throw new BadRequestException(
        'This provider does not offer the requested service',
      );
    }

    const slots = await this.availabilityService.getAvailableSlots(
      dto.providerId,
      dateStr,
      duration,
      { excludeAppointmentId: id },
    );
    if (!slots.includes(scheduledTime)) {
      throw new BadRequestException(
        'This provider is not available at the requested time',
      );
    }

    // Anchor the appointment to the assigned provider's own offering when available,
    // so reviews / metrics attach to the right GivenService.
    const providerGiven = await this.prisma.givenService.findFirst({
      where: {
        ownerId: dto.providerId,
        serviceId: appointment.givenService.serviceId,
        active: true,
      },
      select: { id: true },
    });

    const assignConfirmedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findUnique({
        where: { id },
        select: { companyRespondedAt: true },
      });
      const row = await tx.appointment.update({
        where: { id },
        data: {
          providerId: dto.providerId,
          ...(providerGiven ? { givenServiceId: providerGiven.id } : {}),
          ...(dto.confirm
            ? {
                status: AppointmentStatus.CONFIRMED,
                confirmedAt: assignConfirmedAt,
                companyRespondedAt: existing?.companyRespondedAt ?? assignConfirmedAt,
              }
            : {}),
        },
      });
      if (dto.confirm) {
        await recomputeCompanyAverageResponseTime(tx, companyId);
      }
      return row;
    });

    const companyName = await this.resolveCompanyName(companyId);
    const formattedDate = this.formatDate(dateStr);

    if (dto.confirm) {
      this.notifyProviderAssigned(
        dto.providerId,
        companyName,
        formattedDate,
        scheduledTime,
        id,
      );
    }

    if (dto.confirm) {
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: 'Appointment confirmed ✓',
        body: `${companyName} confirmed your booking for ${formattedDate} at ${scheduledTime}`,
        data: { appointmentId: id, screen: 'ClientAppointmentDetail' },
      });
    }

    this.broadcast(id);

    const providerName =
      `${provider.user?.firstName ?? ''} ${provider.user?.lastName ?? ''}`.trim() ||
      'a provider';
    await this.logAdminAction(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.APPOINTMENT_ASSIGNED,
      `assigned ${providerName} to order ${this.orderRef(id)}${dto.confirm ? ' and confirmed the booking' : ''}.`,
      {
        appointmentId: id,
        providerId: dto.providerId,
        confirmed: Boolean(dto.confirm),
      },
      ipAddress,
    );

    return updated;
  }

  async getRescheduleOptions(
    companyAdminUserId: string,
    id: string,
    dto: GetRescheduleOptionsDto,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const appointment = await this.getAppointmentForReschedule(companyId, id);
    const employees = await this.employeesOfferingService(
      companyId,
      appointment.givenService.serviceId,
    );
    const duration = appointment.givenService.estimatedDurationMinutes ?? 60;

    if (dto.date) {
      this.assertNotPastDate(dto.date);
      const slots = await this.aggregateAvailableSlots(
        employees,
        dto.date,
        duration,
        id,
      );
      return {
        options: slots.length > 0 ? [{ date: dto.date, slots }] : [],
        durationMinutes: duration,
      };
    }

    const days = dto.days ?? 30;
    const start = this.todayYmd();
    const dayResults = await Promise.all(
      Array.from({ length: days }, (_, offset) => {
        const dateStr = this.addDaysYmd(start, offset);
        return this.aggregateAvailableSlots(
          employees,
          dateStr,
          duration,
          id,
        ).then((slots) => ({ date: dateStr, slots }));
      }),
    );
    const options = dayResults.filter((d) => d.slots.length > 0);

    return { options, durationMinutes: duration };
  }

  // ─── Available providers for an appointment's slot ────────────────────────

  async getAvailableProviders(companyAdminUserId: string, id: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        givenService: {
          select: { serviceId: true, estimatedDurationMinutes: true },
        },
      },
    });
    if (!appointment || appointment.companyId !== companyId) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        appointment.status === AppointmentStatus.RESCHEDULED
          ? 'Wait for the client to accept the proposed time before assigning a provider'
          : 'This order cannot be assigned in its current status',
      );
    }

    const employees = await this.employeesOfferingService(
      companyId,
      appointment.givenService.serviceId,
    );

    const { dateStr, scheduledTime } = this.effectiveSlot(appointment);
    const duration = appointment.givenService.estimatedDurationMinutes ?? 60;
    const slotOptions = { excludeAppointmentId: id };

    const results = await Promise.all(
      employees.map(async (emp) => {
        let available = false;
        try {
          const slots = await this.availabilityService.getAvailableSlots(
            emp.id,
            dateStr,
            duration,
            slotOptions,
          );
          available = slots.includes(scheduledTime);
        } catch {
          available = false;
        }
        return {
          id: emp.id,
          displayName:
            `${emp.user?.firstName ?? ''} ${emp.user?.lastName ?? ''}`.trim() ||
            'Provider',
          photoUrl: emp.photoUrl ?? null,
          city: emp.city ?? '',
          averageRating: Number(emp.averageRating ?? 0),
          isTopProvider: Boolean(emp.isTopProvider),
          available,
          isCurrentlyAssigned: appointment.providerId === emp.id,
        };
      }),
    );

    return results
      .filter((p) => p.available)
      .sort((a, b) => b.averageRating - a.averageRating);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private orderRef(id: string): string {
    return `#ORD-${id.slice(0, 8).toUpperCase()}`;
  }

  private async logAdminAction(
    companyId: string,
    actorAdminId: string,
    action: CompanyAuditAction,
    messageSuffix: string,
    metadata: Prisma.InputJsonValue,
    ipAddress?: string,
  ): Promise<void> {
    const actor = await this.audit.actorFirstName(actorAdminId);
    await this.audit.log(
      companyId,
      actorAdminId,
      action,
      `${actor} ${messageSuffix}`,
      metadata,
      ipAddress,
    );
  }

  private async getAppointmentForReschedule(companyId: string, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        givenService: {
          select: { serviceId: true, estimatedDurationMinutes: true },
        },
      },
    });
    if (!appointment || appointment.companyId !== companyId) {
      throw new NotFoundException('Appointment not found');
    }
    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException(
        'Reschedule options are only available for pending orders',
      );
    }
    return appointment;
  }

  private async employeesOfferingService(companyId: string, serviceId: string) {
    const offerings = await this.prisma.givenService.findMany({
      where: {
        serviceId,
        active: true,
        ownerType: OwnerType.PROVIDER,
      },
      select: { ownerId: true },
    });
    const offeringProviderIds = [...new Set(offerings.map((o) => o.ownerId))];
    if (offeringProviderIds.length === 0) return [];

    return this.prisma.provider.findMany({
      where: {
        companyId,
        type: ProviderType.EMPLOYEE,
        id: { in: offeringProviderIds },
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
  }

  private async aggregateAvailableSlots(
    employees: { id: string }[],
    dateStr: string,
    durationMinutes: number,
    excludeAppointmentId: string,
  ): Promise<string[]> {
    if (employees.length === 0) return [];

    const slotOptions = { excludeAppointmentId };
    const union = new Set<string>();

    await Promise.all(
      employees.map(async (emp) => {
        try {
          const slots = await this.availabilityService.getAvailableSlots(
            emp.id,
            dateStr,
            durationMinutes,
            slotOptions,
          );
          for (const slot of slots) {
            union.add(slot);
          }
        } catch {
          /* ignore per-employee failures */
        }
      }),
    );

    return this.filterFutureSlots(dateStr, [...union].sort());
  }

  private async assertRescheduleSlotAvailable(
    companyId: string,
    appointmentId: string,
    dateStr: string,
    time: string,
  ): Promise<void> {
    const appointment = await this.getAppointmentForReschedule(
      companyId,
      appointmentId,
    );
    const employees = await this.employeesOfferingService(
      companyId,
      appointment.givenService.serviceId,
    );
    const duration = appointment.givenService.estimatedDurationMinutes ?? 60;
    const slots = await this.aggregateAvailableSlots(
      employees,
      dateStr,
      duration,
      appointmentId,
    );
    if (!slots.includes(time)) {
      throw new BadRequestException(
        'The selected time is not available for this service on that day',
      );
    }
  }

  private assertNotPastDate(dateStr: string): void {
    if (dateStr < this.todayYmd()) {
      throw new BadRequestException('Cannot load slots for a past date');
    }
  }

  private todayYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private addDaysYmd(baseYmd: string, days: number): string {
    const [y, mo, da] = baseYmd.split('-').map(Number);
    const d = new Date(y, (mo ?? 1) - 1, da ?? 1);
    d.setDate(d.getDate() + days);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  private filterFutureSlots(dateStr: string, slots: string[]): string[] {
    const today = this.todayYmd();
    if (dateStr !== today) return slots;

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return slots.filter((slot) => this.timeToMinutes(slot) > nowMin);
  }

  private timeToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map((p) => Number(p));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }

  /** Slot used for availability checks (proposed time while awaiting client). */
  private effectiveSlot(appointment: {
    status: AppointmentStatus;
    scheduledDate: Date;
    scheduledTime: string;
    rescheduleDate: Date | null;
    rescheduleTime: string | null;
  }): { dateStr: string; scheduledTime: string } {
    if (
      appointment.status === AppointmentStatus.RESCHEDULED &&
      appointment.rescheduleDate &&
      appointment.rescheduleTime
    ) {
      return {
        dateStr: appointment.rescheduleDate.toISOString().slice(0, 10),
        scheduledTime: appointment.rescheduleTime,
      };
    }
    return {
      dateStr: appointment.scheduledDate.toISOString().slice(0, 10),
      scheduledTime: appointment.scheduledTime,
    };
  }

  private notifyProviderAssigned(
    providerId: string,
    companyName: string,
    formattedDate: string,
    scheduledTime: string,
    appointmentId: string,
  ): void {
    void this.notificationsService.send({
      userId: providerId,
      type: NotificationType.APPOINTMENT_PROVIDER_ASSIGNED,
      title: 'New assignment',
      body: `${companyName} assigned you a job on ${formattedDate} at ${scheduledTime}`,
      data: { appointmentId, screen: 'ProviderAppointmentDetail' },
    });
  }

  private async resolveCompanyName(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { companyName: true },
    });
    return company?.companyName?.trim() || 'The company';
  }

  private broadcast(appointmentId: string): void {
    void this.fetchAndBroadcast(appointmentId);
  }

  private async fetchAndBroadcast(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: COMPANY_APPOINTMENT_INCLUDE,
    });
    if (!appointment) return;
    void this.realtime.broadcastAppointmentUpdated(
      appointmentId,
      JSON.parse(JSON.stringify(appointment)) as Record<string, unknown>,
    );
  }

  private formatDate(dateStr: string): string {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
