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
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { AvailabilityService } from '../availability/availability.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClientRespondRescheduleDto, ClientRescheduleAction } from './dto/client-respond-reschedule.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ExecutionAction, ExecutionActionDto } from './dto/execution-action.dto';
import { ProviderRespondAction, RespondAppointmentDto } from './dto/respond-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
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

    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.providerId },
      select: { id: true, companyId: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const providerMatchesGivenService =
      (givenService.ownerType === OwnerType.PROVIDER &&
        givenService.ownerId === dto.providerId) ||
      (givenService.ownerType === OwnerType.COMPANY &&
        provider.companyId &&
        provider.companyId === givenService.ownerId);
    if (!providerMatchesGivenService) {
      throw new BadRequestException('Provider does not match the selected given service');
    }

    const duration = givenService.estimatedDurationMinutes ?? 60;
    const availableSlots = await this.availabilityService.getAvailableSlots(
      dto.providerId,
      dto.scheduledDate,
      duration,
    );
    if (!availableSlots.includes(dto.scheduledTime)) {
      throw new BadRequestException('Selected slot is not available');
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        clientId,
        givenServiceId: dto.givenServiceId,
        providerId: dto.providerId,
        status: AppointmentStatus.PENDING,
        scheduledDate: new Date(dto.scheduledDate),
        scheduledTime: dto.scheduledTime,
        notes: dto.notes?.trim() || null,
        photoUrls: dto.photoUrls ?? [],
      },
    });

    const [client, providerUser, givenServiceDetails] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.providerId },
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

    void this.notificationsService.send({
      userId: appointment.providerId,
      type: NotificationType.APPOINTMENT_NEW_REQUEST,
      title: 'New booking request',
      body: `${clientName} requested ${serviceName} on ${formattedDate} at ${dto.scheduledTime}`,
      data: { appointmentId: appointment.id, screen: 'ProviderAppointmentDetail' },
    });

    return appointment;
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
        provider: { include: { user: true } },
        confirmations: true,
      },
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
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.providerId !== providerId) {
      throw new ForbiddenException('Access denied');
    }
    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException('Appointment cannot be responded to in current status');
    }

    if (dto.action === ProviderRespondAction.CONFIRMED) {
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CONFIRMED,
          refusalReason: null,
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
      return updated;
    }

    if (dto.action === ProviderRespondAction.REFUSED) {
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.REFUSED,
          refusalReason: dto.refusalReason?.trim() || null,
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
        type: NotificationType.APPOINTMENT_REFUSED,
        title: 'Booking request refused',
        body: `${providerName} could not accept your request. Reason: ${dto.refusalReason?.trim() || 'Not specified'}`,
        data: { appointmentId, screen: 'ClientAppointmentDetail' },
      });
      return updated;
    }

    if (!dto.rescheduleDate || !dto.rescheduleTime) {
      throw new BadRequestException(
        'rescheduleDate and rescheduleTime are required for RESCHEDULED action',
      );
    }
    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.RESCHEDULED,
        rescheduleDate: new Date(dto.rescheduleDate),
        rescheduleTime: dto.rescheduleTime,
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
    const formattedRescheduleDate = this.formatDateForNotification(dto.rescheduleDate);
    void this.notificationsService.send({
      userId: appointment.clientId,
      type: NotificationType.APPOINTMENT_RESCHEDULED,
      title: 'New time proposed',
      body: `${providerName} proposed a new time: ${formattedRescheduleDate} at ${dto.rescheduleTime}`,
      data: { appointmentId, screen: 'ClientAppointmentDetail' },
    });
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
      const updated = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CONFIRMED,
          scheduledDate: appointment.rescheduleDate,
          scheduledTime: appointment.rescheduleTime,
          rescheduleDate: null,
          rescheduleTime: null,
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
      void this.notificationsService.send({
        userId: appointment.providerId,
        type: NotificationType.APPOINTMENT_RESCHEDULE_ACCEPTED,
        title: 'Reschedule accepted',
        body: `${clientName} accepted the new time: ${formattedDate} at ${appointment.rescheduleTime}`,
        data: { appointmentId, screen: 'ProviderAppointmentDetail' },
      });
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
    void this.notificationsService.send({
      userId: appointment.providerId,
      type: NotificationType.APPOINTMENT_RESCHEDULE_DECLINED,
      title: 'Reschedule declined',
      body: `${clientName} declined the proposed time and cancelled the request`,
      data: { appointmentId, screen: 'ProviderAppointmentDetail' },
    });
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
      appointment.status !== AppointmentStatus.PENDING
    ) {
      throw new BadRequestException('Appointment cannot be cancelled in current status');
    }

    const updated = await this.prisma.appointment.update({
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
    const [clientUser, providerUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: appointment.clientId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: appointment.providerId },
        select: { firstName: true, lastName: true },
      }),
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
      void this.notificationsService.send({
        userId: appointment.providerId,
        type: NotificationType.APPOINTMENT_CANCELLED_CLIENT,
        title: 'Appointment cancelled',
        body: `${clientName} cancelled the appointment for ${formattedDate} at ${appointment.scheduledTime}`,
        data: { appointmentId, screen: 'ProviderAppointmentDetail' },
      });
    } else {
      void this.notificationsService.send({
        userId: appointment.clientId,
        type: NotificationType.APPOINTMENT_CANCELLED_PROVIDER,
        title: 'Appointment cancelled by provider',
        body: `${providerName} cancelled your appointment for ${formattedDate}. ${reason?.trim() || ''}`,
        data: { appointmentId, screen: 'ClientAppointmentDetail' },
      });
    }
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
          ...(dto.photoUrls ? { beforePhotoUrls: dto.photoUrls } : {}),
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
        ...(dto.photoUrls ? { afterPhotoUrls: dto.photoUrls } : {}),
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
        return this.prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            status: AppointmentStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        });
      }
      return this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    }

    const providerEnd = await this.prisma.appointmentConfirmation.findUnique({
      where: {
        appointmentId_role_type: {
          appointmentId,
          role: 'PROVIDER',
          type: AppointmentConfirmationType.END,
        },
      },
    });

    if (providerEnd) {
      const now = new Date();
      const startedAt = appointment.startedAt ?? now;
      const durationMinutes = Math.max(
        0,
        Math.round((now.getTime() - startedAt.getTime()) / 60000),
      );
      return this.prisma.$transaction(async (tx) => {
        const updatedAppointment = await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            status: AppointmentStatus.COMPLETED,
            completedAt: now,
            durationMinutes,
          },
        });

        // Provider model has no totalCompletedJobs field in current schema,
        // so we increment the metric at GivenService level instead.
        await tx.givenService.update({
          where: { id: appointment.givenServiceId },
          data: {
            totalCompletedJobs: {
              increment: 1,
            },
          },
        });

        const [cancelledByProviderCount, totalAppointmentsCount, confirmedAppointments] =
          await Promise.all([
            tx.appointment.count({
              where: {
                providerId: appointment.providerId,
                status: AppointmentStatus.CANCELLED_PROVIDER,
              },
            }),
            tx.appointment.count({
              where: {
                providerId: appointment.providerId,
              },
            }),
            tx.appointment.findMany({
              where: {
                providerId: appointment.providerId,
                status: AppointmentStatus.CONFIRMED,
              },
              select: {
                createdAt: true,
                updatedAt: true,
              },
            }),
          ]);

        const cancellationRate =
          totalAppointmentsCount > 0
            ? (cancelledByProviderCount / totalAppointmentsCount) * 100
            : 0;

        const averageResponseTime =
          confirmedAppointments.length > 0
            ? confirmedAppointments.reduce((sum, row) => {
                const minutes = (row.updatedAt.getTime() - row.createdAt.getTime()) / 60000;
                return sum + Math.max(0, minutes);
              }, 0) / confirmedAppointments.length
            : 0;

        await tx.provider.update({
          where: { id: appointment.providerId },
          data: {
            cancellationRate,
            averageResponseTime,
          },
        });

        const [clientUser, providerUser] = await Promise.all([
          tx.user.findUnique({
            where: { id: appointment.clientId },
            select: { firstName: true, lastName: true },
          }),
          tx.user.findUnique({
            where: { id: appointment.providerId },
            select: { firstName: true, lastName: true },
          }),
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
        void this.notificationsService.send({
          userId: appointment.providerId,
          type: NotificationType.APPOINTMENT_COMPLETED,
          title: 'Service completed ✓',
          body: `Your session with ${clientName} is complete. Duration: ${durationMinutes} min`,
          data: { appointmentId, screen: 'ProviderAppointmentDetail' },
        });
        void this.notificationsService.send({
          userId: appointment.clientId,
          type: NotificationType.APPOINTMENT_COMPLETED,
          title: 'Service completed ✓',
          body: `Your service with ${providerName} is done. How was your experience?`,
          data: {
            appointmentId,
            screen: 'ClientAppointmentDetail',
            action: 'LEAVE_REVIEW',
          },
        });

        return updatedAppointment;
      });
    }

    return this.prisma.appointment.findUnique({ where: { id: appointmentId } });
  }

  async getProviderCalendar(providerId: string, from: string, to: string) {
    return this.prisma.appointment.findMany({
      where: {
        providerId,
        scheduledDate: {
          gte: new Date(from),
          lte: new Date(to),
        },
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
}
