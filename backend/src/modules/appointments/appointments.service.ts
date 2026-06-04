import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentConfirmationType,
  AppointmentStatus,
  NotificationType,
  OwnerType,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseRealtimeService } from '../supabase/supabase-realtime.service';
import { ClientRespondRescheduleDto, ClientRescheduleAction } from './dto/client-respond-reschedule.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ExecutionAction, ExecutionActionDto } from './dto/execution-action.dto';
import { ProviderRespondAction, RespondAppointmentDto } from './dto/respond-appointment.dto';
import {
  recomputeIndependentProviderAverageResponseTime,
  recomputeIndependentProviderCancellationRate,
} from './helpers/recompute-provider-metrics';
import {
  backfillCompletedJobsCount,
  finalizeAppointmentCompletion,
  hasProviderEndConfirmation,
} from './helpers/complete-appointment';
import { recomputeProviderTopProviderStatus } from './helpers/top-provider-status';

@Injectable()
export class AppointmentsService {
  private readonly appointmentDetailInclude = {
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
    client: { include: { user: true } },
    provider: { include: { user: true } },
    company: true,
    confirmations: true,
    complaints: {
      select: { id: true },
      take: 1,
    },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
    private readonly realtime: SupabaseRealtimeService,
  ) {}

  async createAppointment(clientId: string, dto: CreateAppointmentDto) {
    const givenService = await this.prisma.givenService.findUnique({
      where: { id: dto.givenServiceId },
      select: {
        id: true,
        active: true,
        ownerType: true,
        ownerId: true,
        estimatedDurationMinutes: true,
      },
    });
    if (!givenService || !givenService.active) {
      throw new BadRequestException('Given service is not active or does not exist');
    }

    // For "any provider" company bookings the client doesn't choose a provider;
    // the company admin assigns one later.
    const assignedProviderId = dto.providerId ?? null;

    let providerMeta: { type: ProviderType; companyId: string | null } | null =
      null;
    if (assignedProviderId) {
      providerMeta = await this.prisma.provider.findUnique({
        where: { id: assignedProviderId },
        select: { type: true, companyId: true },
      });
      if (!providerMeta) {
        throw new NotFoundException('Provider not found');
      }
    }

    const isCompanyBooking = !!dto.companyId;
    const isEmployeeBooking =
      !isCompanyBooking &&
      providerMeta?.type === ProviderType.EMPLOYEE &&
      !!providerMeta.companyId;
    const appointmentCompanyId =
      dto.companyId ?? (isEmployeeBooking ? providerMeta!.companyId : null);

    if (isCompanyBooking) {
      await this.validateCompanyBooking(dto, givenService);
    } else {
      if (!assignedProviderId) {
        throw new BadRequestException('providerId is required for this booking');
      }
      await this.validateProviderBooking(dto, givenService, assignedProviderId);
    }

    // Slot availability is only enforced when a concrete provider is targeted.
    if (assignedProviderId) {
      const duration = givenService.estimatedDurationMinutes ?? 60;
      const availableSlots = await this.availabilityService.getAvailableSlots(
        assignedProviderId,
        dto.scheduledDate,
        duration,
      );
      if (!availableSlots.includes(dto.scheduledTime)) {
        throw new BadRequestException('Selected slot is not available');
      }
    }

    const photoUrls = this.validateClientRequestPhotoUrls(
      clientId,
      dto.photoUrls,
    );

    const appointment = await this.prisma.appointment.create({
      data: {
        clientId,
        givenServiceId: dto.givenServiceId,
        providerId: assignedProviderId,
        companyId: appointmentCompanyId,
        status: AppointmentStatus.PENDING,
        scheduledDate: new Date(dto.scheduledDate),
        scheduledTime: dto.scheduledTime,
        notes: dto.notes?.trim() || null,
        photoUrls,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      },
    });

    const [client, givenServiceDetails] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.givenService.findUnique({
        where: { id: dto.givenServiceId },
        select: {
          service: {
            select: {
              translations: {
                select: { name: true },
                orderBy: { locale: 'asc' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const clientName = this.buildDisplayName(client?.firstName, client?.lastName, 'A client');
    const serviceName =
      givenServiceDetails?.service.translations[0]?.name?.trim() || 'requested service';
    const formattedDate = this.formatDateForNotification(dto.scheduledDate);

    if (isCompanyBooking || isEmployeeBooking) {
      // Company marketplace / employee provider: notify company admin only.
      const companyIdForNotify =
        dto.companyId ?? providerMeta?.companyId ?? null;
      if (companyIdForNotify) {
        const adminUserId =
          await this.resolveCompanyAdminUserId(companyIdForNotify);
        if (adminUserId) {
          void this.notificationsService.send({
            userId: adminUserId,
            type: NotificationType.COMPANY_NEW_REQUEST,
            title: 'New service request',
            body: `${clientName} requested ${serviceName} on ${formattedDate} at ${dto.scheduledTime}`,
            data: { appointmentId: appointment.id, screen: 'CompanyOrders' },
          });
        }
      }
    } else if (assignedProviderId) {
      void this.notificationsService.send({
        userId: assignedProviderId,
        type: NotificationType.APPOINTMENT_NEW_REQUEST,
        title: 'New booking request',
        body: `${clientName} requested ${serviceName} on ${formattedDate} at ${dto.scheduledTime}`,
        data: { appointmentId: appointment.id, screen: 'ProviderAppointmentDetail' },
      });
    }

    this.emitAppointmentUpdated(appointment.id);
    return appointment;
  }

  /** Validates an independent / direct provider booking. */
  private async validateProviderBooking(
    dto: CreateAppointmentDto,
    givenService: { ownerType: OwnerType; ownerId: string },
    providerId: string,
  ): Promise<void> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, companyId: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    const providerMatchesGivenService =
      (givenService.ownerType === OwnerType.PROVIDER &&
        givenService.ownerId === providerId) ||
      (givenService.ownerType === OwnerType.COMPANY &&
        provider.companyId &&
        provider.companyId === givenService.ownerId);
    if (!providerMatchesGivenService) {
      throw new BadRequestException('Provider does not match the selected given service');
    }
  }

  /**
   * Validates a company booking. The offering (givenService) must belong to the
   * company — either company-owned, or owned by one of its employees. When a
   * provider is preselected they must be an employee of that company and own the
   * offering.
   */
  private async validateCompanyBooking(
    dto: CreateAppointmentDto,
    givenService: { ownerType: OwnerType; ownerId: string },
  ): Promise<void> {
    const companyId = dto.companyId!;
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // The offering must be attributable to this company.
    let offeringBelongsToCompany = false;
    if (givenService.ownerType === OwnerType.COMPANY) {
      offeringBelongsToCompany = givenService.ownerId === companyId;
    } else {
      const owner = await this.prisma.provider.findUnique({
        where: { id: givenService.ownerId },
        select: { companyId: true },
      });
      offeringBelongsToCompany = owner?.companyId === companyId;
    }
    if (!offeringBelongsToCompany) {
      throw new BadRequestException('Service does not belong to the selected company');
    }

    // If the client preselected a provider, validate they're an employee who owns the offering.
    if (dto.providerId) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: dto.providerId },
        select: { id: true, companyId: true },
      });
      if (!provider || provider.companyId !== companyId) {
        throw new BadRequestException('Selected provider is not part of this company');
      }
      if (
        givenService.ownerType === OwnerType.PROVIDER &&
        givenService.ownerId !== dto.providerId
      ) {
        throw new BadRequestException('Provider does not match the selected offering');
      }
    }
  }

  /** Returns the user id of a company's admin (used for notifications), or null. */
  private async resolveCompanyAdminUserId(companyId: string): Promise<string | null> {
    const admin = await this.prisma.companyAdmin.findFirst({
      where: { companyId },
      select: { id: true },
    });
    return admin?.id ?? null;
  }

  async getMyAppointmentsAsClient(clientId: string, status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: {
        clientId,
        ...(status ? { status } : {}),
      },
      include: {
        givenService: {
          include: {
            service: {
              include: {
                translations: true,
                category: {
                  include: { translations: true },
                },
              },
            },
          },
        },
        provider: {
          include: {
            user: true,
          },
        },
        company: true,
      },
      orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
    });
  }

  async getMyAppointmentsAsProvider(providerId: string, status?: AppointmentStatus) {
    return this.prisma.appointment.findMany({
      where: {
        providerId,
        ...(status ? { status } : {}),
      },
      include: {
        givenService: true,
        client: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
    });
  }

  async getAppointmentById(id: string, requesterId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: this.appointmentDetailInclude,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.clientId !== requesterId && appointment.providerId !== requesterId) {
      throw new ForbiddenException('Access denied');
    }
    return appointment;
  }

  async providerRespond(
    appointmentId: string,
    providerId: string,
    dto: RespondAppointmentDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        providerId: true,
        clientId: true,
        status: true,
        scheduledDate: true,
        scheduledTime: true,
        rescheduleDate: true,
        rescheduleTime: true,
        givenService: { select: { estimatedDurationMinutes: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.providerId !== providerId) {
      throw new ForbiddenException('Access denied');
    }

    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { type: true },
    });
    if (provider?.type === ProviderType.EMPLOYEE) {
      throw new ForbiddenException(
        'Company employees cannot accept or refuse bookings. Your company admin manages pending orders.',
      );
    }

    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException('Appointment cannot be responded to in current status');
    }

    const slotPassed =
      appointment.status === AppointmentStatus.PENDING &&
      this.isScheduledSlotPast(appointment.scheduledDate, appointment.scheduledTime);

    if (
      slotPassed &&
      (dto.action === ProviderRespondAction.CONFIRMED ||
        dto.action === ProviderRespondAction.REFUSED)
    ) {
      throw new BadRequestException(
        'The requested appointment time has passed. Propose a new time instead of accepting or refusing.',
      );
    }

    const respondedAt = new Date();

    if (dto.action === ProviderRespondAction.CONFIRMED) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: { providerRespondedAt: true },
        });
        const row = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: AppointmentStatus.CONFIRMED,
            refusalReason: null,
            confirmedAt: respondedAt,
            providerRespondedAt: existing?.providerRespondedAt ?? respondedAt,
          },
        });
        await recomputeIndependentProviderAverageResponseTime(tx, providerId);
        await recomputeProviderTopProviderStatus(tx, providerId);
        return row;
      });
      const providerUser = await this.prisma.user.findUnique({
        where: { id: providerId },
        select: { firstName: true, lastName: true },
      });
      const providerName = this.buildDisplayName(
        providerUser?.firstName,
        providerUser?.lastName,
        'Your provider',
      );
      const formattedDate = this.formatDateForNotification(
        appointment.scheduledDate.toISOString().slice(0, 10),
      );
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_CONFIRMED,
        title: 'Appointment confirmed ✓',
        body: `${providerName} confirmed your booking for ${formattedDate} at ${appointment.scheduledTime}`,
        data: { appointmentId, screen: 'ClientAppointmentDetail' },
      });
      this.emitAppointmentUpdated(appointmentId);
      return updated;
    }

    if (dto.action === ProviderRespondAction.REFUSED) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: { providerRespondedAt: true },
        });
        const row = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: AppointmentStatus.REFUSED,
            refusalReason: dto.refusalReason?.trim() || null,
            providerRespondedAt: existing?.providerRespondedAt ?? respondedAt,
          },
        });
        await recomputeIndependentProviderAverageResponseTime(tx, providerId);
        await recomputeProviderTopProviderStatus(tx, providerId);
        return row;
      });
      const providerUser = await this.prisma.user.findUnique({
        where: { id: providerId },
        select: { firstName: true, lastName: true },
      });
      const providerName = this.buildDisplayName(
        providerUser?.firstName,
        providerUser?.lastName,
        'Your provider',
      );
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_REFUSED,
        title: 'Booking request refused',
        body: `${providerName} could not accept your request. Reason: ${dto.refusalReason?.trim() || 'Not specified'}`,
        data: { appointmentId, screen: 'ClientAppointmentDetail' },
      });
      this.emitAppointmentUpdated(appointmentId);
      return updated;
    }

    if (!dto.rescheduleDate || !dto.rescheduleTime) {
      throw new BadRequestException(
        'rescheduleDate and rescheduleTime are required for RESCHEDULED action',
      );
    }
    const rescheduleDate = dto.rescheduleDate;
    const rescheduleTime = dto.rescheduleTime;

    if (this.isScheduledSlotPast(new Date(rescheduleDate), rescheduleTime)) {
      throw new BadRequestException('Proposed time must be in the future');
    }

    const durationMinutes =
      appointment.givenService?.estimatedDurationMinutes ?? 60;
    const daySlots = await this.availabilityService.getProviderDaySlots(
      providerId,
      rescheduleDate,
      durationMinutes,
      { excludeAppointmentId: appointmentId, includePendingHolds: true },
    );
    const proposed = daySlots.slots.find((s) => s.time === rescheduleTime);
    if (!proposed || proposed.status !== 'available') {
      throw new BadRequestException('Selected slot is not available');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { providerRespondedAt: true },
      });
      const row = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.RESCHEDULED,
          rescheduleDate: new Date(rescheduleDate),
          rescheduleTime,
          providerRespondedAt: existing?.providerRespondedAt ?? respondedAt,
        },
      });
      await recomputeIndependentProviderAverageResponseTime(tx, providerId);
      await recomputeProviderTopProviderStatus(tx, providerId);
      return row;
    });
    const providerUser = await this.prisma.user.findUnique({
      where: { id: providerId },
      select: { firstName: true, lastName: true },
    });
    const providerName = this.buildDisplayName(
      providerUser?.firstName,
      providerUser?.lastName,
      'Your provider',
    );
    const formattedRescheduleDate = this.formatDateForNotification(rescheduleDate);
    void this.notificationsService.send({
      userId: appointment.clientId,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: 'New time proposed',
      body: `${providerName} proposed a new time: ${formattedRescheduleDate} at ${rescheduleTime}`,
      data: { appointmentId, screen: 'ClientAppointmentDetail' },
    });
    this.emitAppointmentUpdated(appointmentId);
    return updated;
  }

  async clientRespondReschedule(
    appointmentId: string,
    clientId: string,
    dto: ClientRespondRescheduleDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        clientId: true,
        providerId: true,
        companyId: true,
        status: true,
        rescheduleDate: true,
        rescheduleTime: true,
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.clientId !== clientId) throw new ForbiddenException('Access denied');
    if (appointment.status !== AppointmentStatus.RESCHEDULED) {
      throw new BadRequestException('Appointment is not awaiting reschedule response');
    }

    if (dto.action === ClientRescheduleAction.CONFIRMED) {
      if (!appointment.rescheduleDate || !appointment.rescheduleTime) {
        throw new BadRequestException('Missing proposed reschedule values');
      }
      const isCompanyBooking = !!appointment.companyId;
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: isCompanyBooking
            ? AppointmentStatus.PENDING
            : AppointmentStatus.CONFIRMED,
          scheduledDate: appointment.rescheduleDate,
          scheduledTime: appointment.rescheduleTime,
          rescheduleDate: null,
          rescheduleTime: null,
          confirmedAt: isCompanyBooking ? null : new Date(),
        },
      });
      const clientUser = await this.prisma.user.findUnique({
        where: { id: clientId },
        select: { firstName: true, lastName: true },
      });
      const clientName = this.buildDisplayName(clientUser?.firstName, clientUser?.lastName, 'Client');
      const formattedDate = this.formatDateForNotification(
        appointment.rescheduleDate.toISOString().slice(0, 10),
      );
      if (appointment.providerId && !appointment.companyId) {
        void this.notificationsService.send({
          userId: appointment.providerId,
          type: NotificationType.APPOINTMENT_RESCHEDULE_ACCEPTED,
          title: 'Reschedule accepted',
          body: `${clientName} accepted the new time: ${formattedDate} at ${appointment.rescheduleTime}`,
          data: { appointmentId, screen: 'ProviderAppointmentDetail' },
        });
      }
      if (appointment.companyId) {
        const adminUserId = await this.resolveCompanyAdminUserId(appointment.companyId);
        if (adminUserId) {
          void this.notificationsService.send({
            userId: adminUserId,
            type: NotificationType.APPOINTMENT_RESCHEDULE_ACCEPTED,
            title: 'Reschedule accepted',
            body: `${clientName} accepted the new time: ${formattedDate} at ${appointment.rescheduleTime}`,
            data: { appointmentId, screen: 'CompanyOrders' },
          });
        }
      }
      this.emitAppointmentUpdated(appointmentId);
      return updated;
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED_CLIENT,
        cancelledBy: 'CLIENT',
        cancelledAt: new Date(),
      },
    });
    const clientUser = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { firstName: true, lastName: true },
    });
    const clientName = this.buildDisplayName(clientUser?.firstName, clientUser?.lastName, 'Client');
    if (appointment.providerId && !appointment.companyId) {
      void this.notificationsService.send({
        userId: appointment.providerId,
        type: NotificationType.APPOINTMENT_RESCHEDULE_DECLINED,
        title: 'Reschedule declined',
        body: `${clientName} declined the proposed time and cancelled the request`,
        data: { appointmentId, screen: 'ProviderAppointmentDetail' },
      });
    }
    if (appointment.companyId) {
      const adminUserId = await this.resolveCompanyAdminUserId(appointment.companyId);
      if (adminUserId) {
        void this.notificationsService.send({
          userId: adminUserId,
          type: NotificationType.APPOINTMENT_RESCHEDULE_DECLINED,
          title: 'Reschedule declined',
          body: `${clientName} declined the proposed time and cancelled the request`,
          data: { appointmentId, screen: 'CompanyOrders' },
        });
      }
    }
    this.emitAppointmentUpdated(appointmentId);
    return updated;
  }

  async cancelAppointment(
    appointmentId: string,
    requesterId: string,
    role: 'CLIENT' | 'PROVIDER',
    reason?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        clientId: true,
        providerId: true,
        companyId: true,
        status: true,
        scheduledDate: true,
        scheduledTime: true,
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    const isOwner =
      (role === 'CLIENT' && appointment.clientId === requesterId) ||
      (role === 'PROVIDER' && appointment.providerId === requesterId);
    if (!isOwner) throw new ForbiddenException('Access denied');

    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException('Appointment cannot be cancelled in current status');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status:
            role === 'CLIENT'
              ? AppointmentStatus.CANCELLED_CLIENT
              : AppointmentStatus.CANCELLED_PROVIDER,
          cancelledBy: role,
          cancellationReason: reason?.trim() || null,
          cancelledAt: new Date(),
        },
      });
      if (role === 'PROVIDER' && appointment.providerId) {
        await recomputeIndependentProviderCancellationRate(
          tx,
          appointment.providerId,
        );
        await recomputeProviderTopProviderStatus(tx, appointment.providerId);
      }
      return row;
    });
    const [clientUser, providerUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: appointment.clientId },
        select: { firstName: true, lastName: true },
      }),
      appointment.providerId
        ? this.prisma.user.findUnique({
            where: { id: appointment.providerId },
            select: { firstName: true, lastName: true },
          })
        : Promise.resolve(null),
    ]);
    const clientName = this.buildDisplayName(clientUser?.firstName, clientUser?.lastName, 'Client');
    const providerName = this.buildDisplayName(
      providerUser?.firstName,
      providerUser?.lastName,
      'Your provider',
    );
    const formattedDate = this.formatDateForNotification(
      appointment.scheduledDate.toISOString().slice(0, 10),
    );
    if (role === 'CLIENT') {
      if (appointment.providerId && !appointment.companyId) {
        void this.notificationsService.send({
          userId: appointment.providerId,
          type: NotificationType.APPOINTMENT_CANCELLED_CLIENT,
          title: 'Appointment cancelled',
          body: `${clientName} cancelled the appointment for ${formattedDate} at ${appointment.scheduledTime}`,
          data: { appointmentId, screen: 'ProviderAppointmentDetail' },
        });
      }
      if (appointment.companyId) {
        // Always keep the company admin informed of company bookings.
        const adminUserId = await this.resolveCompanyAdminUserId(appointment.companyId);
        if (adminUserId) {
          void this.notificationsService.send({
            userId: adminUserId,
            type: NotificationType.COMPANY_BOOKING_CANCELLED,
            title: 'Service request cancelled',
            body: `${clientName} cancelled their request for ${formattedDate} at ${appointment.scheduledTime}`,
            data: { appointmentId, screen: 'CompanyOrders' },
          });
        }
      }
    } else {
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_CANCELLED_PROVIDER,
        title: 'Appointment cancelled by provider',
        body: `${providerName} cancelled your appointment for ${formattedDate}. ${reason?.trim() || ''}`,
        data: { appointmentId, screen: 'ClientAppointmentDetail' },
      });
    }
    this.emitAppointmentUpdated(appointmentId);
    return updated;
  }

  async recordExecution(
    appointmentId: string,
    providerId: string,
    dto: ExecutionActionDto,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { confirmations: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.providerId !== providerId) throw new ForbiddenException('Access denied');

    const interventionPhotos = dto.photoUrls?.length
      ? this.validateInterventionPhotoUrls(
          providerId,
          appointmentId,
          dto.photoUrls,
        )
      : undefined;

    if (dto.action === ExecutionAction.EN_ROUTE) {
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new BadRequestException('EN_ROUTE is allowed only from CONFIRMED');
      }
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.EN_ROUTE,
          enRouteAt: new Date(),
        },
      });
      const providerUser = await this.prisma.user.findUnique({
        where: { id: providerId },
        select: { firstName: true, lastName: true },
      });
      const providerName = this.buildDisplayName(
        providerUser?.firstName,
        providerUser?.lastName,
        'Your provider',
      );
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_EN_ROUTE,
        title: '🚗 Provider is on the way',
        body: `${providerName} is heading to you now`,
        data: { appointmentId, screen: 'ClientAppointmentDetail' },
      });
      this.emitAppointmentUpdated(appointmentId);
      return updated;
    }

    if (dto.action === ExecutionAction.START) {
      if (appointment.status !== AppointmentStatus.EN_ROUTE) {
        throw new BadRequestException('START is allowed only from EN_ROUTE');
      }
      const now = new Date();
      await this.prisma.appointmentConfirmation.upsert({
        where: {
          appointmentId_role_type: {
            appointmentId,
            role: 'PROVIDER',
            type: AppointmentConfirmationType.START,
          },
        },
        create: {
          appointmentId,
          confirmedBy: providerId,
          role: 'PROVIDER',
          type: AppointmentConfirmationType.START,
          confirmedAt: now,
        },
        update: {
          confirmedAt: now,
        },
      });
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.IN_PROGRESS,
          // startedAt is set only when the client confirms start (billing/timer).
          ...(interventionPhotos?.length
            ? { beforePhotoUrls: interventionPhotos }
            : {}),
        },
      });
      const providerUser = await this.prisma.user.findUnique({
        where: { id: providerId },
        select: { firstName: true, lastName: true },
      });
      const providerName = this.buildDisplayName(
        providerUser?.firstName,
        providerUser?.lastName,
        'Your provider',
      );
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_STARTED,
        title: 'Please confirm service start',
        body: `${providerName} has arrived. Tap to confirm the service has started.`,
        data: {
          appointmentId,
          screen: 'ClientAppointmentDetail',
          action: 'CONFIRM_START',
        },
      });
      this.emitAppointmentUpdated(appointmentId);
      return updated;
    }

    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException('END is allowed only from IN_PROGRESS');
    }
    const now = new Date();
    const hadProviderEndBefore = !!(await this.prisma.appointmentConfirmation.findUnique({
      where: {
        appointmentId_role_type: {
          appointmentId,
          role: 'PROVIDER',
          type: AppointmentConfirmationType.END,
        },
      },
      select: { id: true },
    }));
    await this.prisma.appointmentConfirmation.upsert({
      where: {
        appointmentId_role_type: {
          appointmentId,
          role: 'PROVIDER',
          type: AppointmentConfirmationType.END,
        },
      },
      create: {
        appointmentId,
        confirmedBy: providerId,
        role: 'PROVIDER',
        type: AppointmentConfirmationType.END,
        confirmedAt: now,
      },
      update: {
        confirmedAt: now,
      },
    });

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(interventionPhotos?.length
          ? { afterPhotoUrls: interventionPhotos }
          : {}),
      },
    });
    if (!hadProviderEndBefore) {
      const providerUser = await this.prisma.user.findUnique({
        where: { id: providerId },
        select: { firstName: true, lastName: true },
      });
      const providerName = this.buildDisplayName(
        providerUser?.firstName,
        providerUser?.lastName,
        'Your provider',
      );
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_PROVIDER_ENDED,
        title: 'Please confirm service completion',
        body: `${providerName} has ended the service. Tap to confirm completion.`,
        data: {
          appointmentId,
          screen: 'ClientAppointmentDetail',
          action: 'CONFIRM_END',
        },
      });
    }
    this.emitAppointmentUpdated(appointmentId);
    return updated;
  }

  async clientConfirm(
    appointmentId: string,
    clientId: string,
    type: 'START' | 'END',
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { confirmations: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.clientId !== clientId) throw new ForbiddenException('Access denied');

    const confirmationType =
      type === 'START'
        ? AppointmentConfirmationType.START
        : AppointmentConfirmationType.END;

    await this.prisma.appointmentConfirmation.upsert({
      where: {
        appointmentId_role_type: {
          appointmentId,
          role: 'CLIENT',
          type: confirmationType,
        },
      },
      create: {
        appointmentId,
        confirmedBy: clientId,
        role: 'CLIENT',
        type: confirmationType,
      },
      update: {
        confirmedAt: new Date(),
      },
    });

    if (type === 'START') {
      const providerStart = await this.prisma.appointmentConfirmation.findUnique({
        where: {
          appointmentId_role_type: {
            appointmentId,
            role: 'PROVIDER',
            type: AppointmentConfirmationType.START,
          },
        },
      });
      if (providerStart) {
        const updated = await this.prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            status: AppointmentStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        });
        this.emitAppointmentUpdated(appointmentId);
        return updated;
      }
      const current = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
      });
      this.emitAppointmentUpdated(appointmentId);
      return current;
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      const completedRow = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { confirmations: true },
      });
      if (
        completedRow &&
        !completedRow.completedJobsCounted &&
        hasProviderEndConfirmation(completedRow.confirmations)
      ) {
        const backfilled = await this.prisma.$transaction((tx) =>
          backfillCompletedJobsCount(tx, completedRow),
        );
        if (backfilled.length === 0) {
          throw new BadRequestException(
            'Could not update completed jobs for this service offering',
          );
        }
      }
      const current = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: this.appointmentDetailInclude,
      });
      this.emitAppointmentUpdated(appointmentId);
      return current ?? appointment;
    }

    const refreshed = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { confirmations: true },
    });
    if (!refreshed) {
      throw new NotFoundException('Appointment not found');
    }

    if (!hasProviderEndConfirmation(refreshed.confirmations)) {
      this.emitAppointmentUpdated(appointmentId);
      return refreshed;
    }

    const finalized = await this.prisma.$transaction((tx) =>
      finalizeAppointmentCompletion(tx, refreshed),
    );

    if (!finalized) {
      throw new BadRequestException(
        'Could not complete this appointment. Ensure the provider ended the service, then try again.',
      );
    }

    const { appointment: completedRow, incrementedGivenServiceIds } = finalized;

    const completedProviderId = refreshed.providerId;
    const durationMinutes = completedRow.durationMinutes;
    const [clientUser, providerUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: refreshed.clientId },
        select: { firstName: true, lastName: true },
      }),
      completedProviderId
        ? this.prisma.user.findUnique({
            where: { id: completedProviderId },
            select: { firstName: true, lastName: true },
          })
        : Promise.resolve(null),
    ]);
    const clientName = this.buildDisplayName(
      clientUser?.firstName,
      clientUser?.lastName,
      'Client',
    );
    const providerName = this.buildDisplayName(
      providerUser?.firstName,
      providerUser?.lastName,
      'Your provider',
    );
    if (completedProviderId) {
      void this.notificationsService.send({
        userId: completedProviderId,
        type: NotificationType.APPOINTMENT_COMPLETED,
        title: 'Service completed ✓',
        body: `Your session with ${clientName} is complete. Duration: ${durationMinutes} min`,
        data: { appointmentId, screen: 'ProviderAppointmentDetail' },
      });
    }
    void this.notificationsService.send({
      userId: refreshed.clientId,
      type: NotificationType.APPOINTMENT_COMPLETED,
      title: 'Service completed ✓',
      body: `Your service with ${providerName} is done. How was your experience?`,
      data: {
        appointmentId,
        screen: 'ClientAppointmentDetail',
        action: 'LEAVE_REVIEW',
      },
    });

    const updated = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: this.appointmentDetailInclude,
    });
    this.emitAppointmentUpdated(appointmentId);
    return updated;
  }

  async getProviderCalendar(providerId: string, from: string, to: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { type: true },
    });
    return this.prisma.appointment.findMany({
      where: {
        providerId,
        scheduledDate: {
          gte: new Date(from),
          lte: new Date(to),
        },
        ...(provider?.type === ProviderType.EMPLOYEE
          ? { status: { not: AppointmentStatus.PENDING } }
          : {}),
      },
      include: {
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
        client: { include: { user: true } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    });
  }

  private emitAppointmentUpdated(appointmentId: string): void {
    void this.fetchAndBroadcastAppointment(appointmentId);
  }

  private async fetchAndBroadcastAppointment(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: this.appointmentDetailInclude,
    });
    if (!appointment) return;
    void this.realtime.broadcastAppointmentUpdated(
      appointmentId,
      JSON.parse(JSON.stringify(appointment)) as Record<string, unknown>,
    );
  }

  private isScheduledSlotPast(scheduledDate: Date, scheduledTime: string): boolean {
    return Date.now() > this.scheduledSlotStartMs(scheduledDate, scheduledTime);
  }

  private scheduledSlotStartMs(scheduledDate: Date, scheduledTime: string): number {
    const ymd = scheduledDate.toISOString().slice(0, 10);
    const [y, mo, d] = ymd.split('-').map(Number);
    const parts = scheduledTime.split(':');
    const hh = Number(parts[0]) || 0;
    const mm = Number(parts[1]) || 0;
    return new Date(y, (mo || 1) - 1, d || 1, hh, mm, 0, 0).getTime();
  }

  private formatDateForNotification(dateStr: string): string {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  private buildDisplayName(
    firstName?: string | null,
    lastName?: string | null,
    fallback = 'User',
  ): string {
    const fullName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
    return fullName || fallback;
  }

  /** Before/after URLs must live under this provider's folder in `appointment-intervention-photos`. */
  private validateInterventionPhotoUrls(
    providerId: string,
    appointmentId: string,
    urls: string[],
  ): string[] {
    if (urls.length > 10) {
      throw new BadRequestException('Maximum 10 intervention photos per action');
    }
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    if (!base) return urls;
    const newPrefix = `${base}/storage/v1/object/public/appointment-intervention-photos/providers/${providerId}/appointments/${appointmentId}/`;
    const legacyPrefix = `${base}/storage/v1/object/public/gallery/job-evidence/${appointmentId}/`;
    for (const url of urls) {
      if (url.startsWith(newPrefix)) {
        const afterPrefix = url.slice(newPrefix.length);
        if (/^(before|after)\//.test(afterPrefix)) continue;
      }
      if (url.startsWith(legacyPrefix)) continue;
      throw new BadRequestException('Invalid intervention photo URL');
    }
    return urls;
  }

  /** Ensures booking attachments are public URLs from this client's folder in `appointment-request-photos`. */
  private validateClientRequestPhotoUrls(
    clientId: string,
    urls?: string[],
  ): string[] {
    if (!urls?.length) return [];
    if (urls.length > 5) {
      throw new BadRequestException('Maximum 5 request photos allowed');
    }
    const base = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
    if (!base) return urls;
    const expectedPrefix = `${base}/storage/v1/object/public/appointment-request-photos/clients/${clientId}/`;
    for (const url of urls) {
      if (!url.startsWith(expectedPrefix)) {
        throw new BadRequestException('Invalid appointment request photo URL');
      }
    }
    return urls;
  }
}
