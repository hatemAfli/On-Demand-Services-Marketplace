import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentConfirmationType,
  AppointmentStatus,
  OwnerType,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { AvailabilityService } from '../availability/availability.service';
import { ClientRespondRescheduleDto, ClientRescheduleAction } from './dto/client-respond-reschedule.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ExecutionAction, ExecutionActionDto } from './dto/execution-action.dto';
import { ProviderRespondAction, RespondAppointmentDto } from './dto/respond-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
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

    return this.prisma.appointment.create({
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
      select: { id: true, providerId: true, status: true },
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
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CONFIRMED,
          refusalReason: null,
        },
      });
    }

    if (dto.action === ProviderRespondAction.REFUSED) {
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.REFUSED,
          refusalReason: dto.refusalReason?.trim() || null,
        },
      });
    }

    if (!dto.rescheduleDate || !dto.rescheduleTime) {
      throw new BadRequestException(
        'rescheduleDate and rescheduleTime are required for RESCHEDULED action',
      );
    }
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.RESCHEDULED,
        rescheduleDate: new Date(dto.rescheduleDate),
        rescheduleTime: dto.rescheduleTime,
      },
    });
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
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CONFIRMED,
          scheduledDate: appointment.rescheduleDate,
          scheduledTime: appointment.rescheduleTime,
          rescheduleDate: null,
          rescheduleTime: null,
        },
      });
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED_CLIENT,
        cancelledBy: 'CLIENT',
        cancelledAt: new Date(),
      },
    });
  }

  async cancelAppointment(
    appointmentId: string,
    requesterId: string,
    role: 'CLIENT' | 'PROVIDER',
    reason?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clientId: true, providerId: true, status: true },
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

    return this.prisma.appointment.update({
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
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.EN_ROUTE,
          enRouteAt: new Date(),
        },
      });
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
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.IN_PROGRESS,
          startedAt: now,
          ...(dto.photoUrls ? { beforePhotoUrls: dto.photoUrls } : {}),
        },
      });
    }

    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException('END is allowed only from IN_PROGRESS');
    }
    const now = new Date();
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

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        ...(dto.photoUrls ? { afterPhotoUrls: dto.photoUrls } : {}),
      },
    });
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
            startedAt: appointment.startedAt ?? new Date(),
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
}
