import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  AppointmentStatus,
  Complaint,
  ComplaintCategory,
  ComplaintDecision,
  ComplaintStatus,
  Locale,
  NotificationType,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { GetComplaintsDto } from './dto/get-complaints.dto';
import { ReviewComplaintDto } from './dto/review-complaint.dto';
import { WithdrawComplaintDto } from './dto/withdraw-complaint.dto';

const COMPLAINT_ALLOWED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.DISPUTED,
];

const DEFAULT_GET_COMPLAINTS_TAKE = 20;
const DEFAULT_GET_COMPLAINTS_SKIP = 0;

const APPOINTMENT_ADMIN_LIST_SELECT = {
  id: true,
  scheduledDate: true,
  scheduledTime: true,
  givenService: {
    select: {
      service: {
        select: {
          translations: {
            where: { locale: Locale.EN },
            select: { name: true, locale: true },
          },
        },
      },
    },
  },
} satisfies Prisma.AppointmentSelect;

type AppointmentAdminListPayload = Prisma.AppointmentGetPayload<{
  select: typeof APPOINTMENT_ADMIN_LIST_SELECT;
}>;

const COMPLAINT_ADMIN_LIST_INCLUDE = {
  client: {
    select: {
      imageUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  provider: {
    select: {
      photoUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  appointment: { select: APPOINTMENT_ADMIN_LIST_SELECT },
} satisfies Prisma.ComplaintInclude;

export type ComplaintAdminListItem = Omit<
  Prisma.ComplaintGetPayload<{ include: typeof COMPLAINT_ADMIN_LIST_INCLUDE }>,
  'appointment'
> & {
  appointment: AppointmentAdminListPayload & { serviceName: string };
};

function pickServiceNameFromAppointment(
  appointment: AppointmentAdminListPayload,
): string {
  const t = appointment.givenService?.service?.translations?.[0];
  return t?.name?.trim() || 'Service';
}

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createComplaint(
    clientUserId: string,
    dto: CreateComplaintDto,
  ): Promise<Complaint> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        provider: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        givenService: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.client.user.id !== clientUserId) {
      throw new ForbiddenException('You can only file a complaint for your own appointments');
    }

    if (!COMPLAINT_ALLOWED_STATUSES.includes(appointment.status)) {
      throw new BadRequestException(
        'You can only report a problem after a service has been initiated.',
      );
    }

    const existingComplaint = await this.prisma.complaint.findUnique({
      where: {
        appointmentId_clientId: {
          appointmentId: dto.appointmentId,
          clientId: appointment.clientId,
        },
      },
    });
    if (existingComplaint) {
      throw new ConflictException('A complaint already exists for this appointment');
    }

    const targetIsEmployee = appointment.provider.type === ProviderType.EMPLOYEE;

    const complaint = await this.prisma.$transaction(async (tx) => {
      const created = await tx.complaint.create({
        data: {
          appointmentId: dto.appointmentId,
          clientId: appointment.clientId,
          providerId: appointment.providerId,
          category: dto.category,
          description: dto.description.trim(),
          evidenceUrls: dto.evidenceUrls ?? [],
          status: ComplaintStatus.OPEN,
          targetIsEmployee,
        },
      });

      await tx.provider.update({
        where: { id: appointment.providerId },
        data: {
          totalComplaints: { increment: 1 },
          activeComplaints: { increment: 1 },
        },
      });

      if (
        appointment.status === AppointmentStatus.IN_PROGRESS ||
        appointment.status === AppointmentStatus.COMPLETED
      ) {
        await tx.appointment.update({
          where: { id: dto.appointmentId },
          data: { status: AppointmentStatus.DISPUTED },
        });
      }

      return created;
    });

    const categoryLabel = this.getCategoryLabel(dto.category);
    const clientName = `${appointment.client.user.firstName} ${appointment.client.user.lastName}`.trim();
    const providerName = `${appointment.provider.user.firstName} ${appointment.provider.user.lastName}`.trim();

    void this.notificationsService.send({
      userId: appointment.provider.user.id,
      type: NotificationType.COMPLAINT_FILED,
      title: 'A complaint has been filed',
      body: `A client reported an issue with your service: ${categoryLabel}. This has been sent to our team for review.`,
      data: { complaintId: complaint.id, screen: 'ProviderComplaints' },
    });

    const admins = await this.prisma.platformAdmin.findMany({
      include: { user: { select: { id: true } } },
    });
    for (const admin of admins) {
      void this.notificationsService.send({
        userId: admin.user.id,
        type: NotificationType.SYSTEM_ANNOUNCEMENT,
        title: '⚠️ New complaint filed',
        body: `${clientName} filed a ${categoryLabel} complaint against ${providerName}`,
        data: { complaintId: complaint.id, screen: 'AdminComplaintDetail' },
      });
    }

    if (targetIsEmployee) {
      this.logger.log(
        `[Complaints] Company admin notification for employee complaint ${complaint.id} — to be implemented in company module`,
      );
    }

    return complaint;
  }

  async getMyComplaints(clientUserId: string): Promise<Complaint[]> {
    return this.prisma.complaint.findMany({
      where: { client: { user: { id: clientUserId } } },
      include: {
        appointment: {
          select: {
            scheduledDate: true,
            scheduledTime: true,
          },
        },
        provider: {
          select: {
            photoUrl: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Minimal complaint rows for the signed-in provider (no client PII). */
  async getMyProviderComplaints(providerUserId: string): Promise<{
    totalComplaints: number;
    activeComplaints: number;
    items: Array<{
      id: string;
      category: ComplaintCategory;
      status: ComplaintStatus;
      decision: ComplaintDecision | null;
      adminResponse: string | null;
      createdAt: Date;
      appointment: {
        scheduledDate: string;
        scheduledTime: string;
        serviceName: string;
      };
    }>;
  }> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerUserId },
      select: { id: true, totalComplaints: true, activeComplaints: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const rows = await this.prisma.complaint.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        status: true,
        decision: true,
        adminResponse: true,
        createdAt: true,
        appointment: { select: APPOINTMENT_ADMIN_LIST_SELECT },
      },
    });

    const items = rows.map((row) => {
      const ap = row.appointment as AppointmentAdminListPayload;
      const sdRaw = ap.scheduledDate as unknown;
      const scheduledDate =
        sdRaw instanceof Date
          ? sdRaw.toISOString().slice(0, 10)
          : String(sdRaw ?? '').slice(0, 10);
      return {
        id: row.id,
        category: row.category,
        status: row.status,
        decision: row.decision,
        adminResponse: row.adminResponse,
        createdAt: row.createdAt,
        appointment: {
          scheduledDate,
          scheduledTime: ap.scheduledTime,
          serviceName: pickServiceNameFromAppointment(ap),
        },
      };
    });

    return {
      totalComplaints: provider.totalComplaints,
      activeComplaints: provider.activeComplaints,
      items,
    };
  }

  async getComplaintById(id: string, requesterId: string): Promise<Complaint> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        appointment: {
          include: {
            client: { include: { user: true } },
            provider: { include: { user: true } },
            givenService: {
              include: {
                service: { include: { translations: true } },
              },
            },
          },
        },
        client: { include: { user: true } },
        provider: { include: { user: true } },
        handledByAdmin: { include: { user: true } },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const isClient = complaint.client.user.id === requesterId;
    const platformAdmin = await this.prisma.platformAdmin.findUnique({
      where: { id: requesterId },
    });
    const isPlatformAdmin = !!platformAdmin;

    if (!isClient && !isPlatformAdmin) {
      throw new ForbiddenException('You cannot view this complaint');
    }

    return complaint;
  }

  async withdrawComplaint(
    clientUserId: string,
    complaintId: string,
    dto: WithdrawComplaintDto,
  ): Promise<Complaint> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        client: { include: { user: { select: { id: true } } } },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    if (complaint.client.user.id !== clientUserId) {
      throw new ForbiddenException('You can only withdraw your own complaints');
    }

    if (
      complaint.status === ComplaintStatus.RESOLVED ||
      complaint.status === ComplaintStatus.DISMISSED
    ) {
      throw new BadRequestException('Cannot withdraw a closed complaint');
    }

    if (complaint.status === ComplaintStatus.WITHDRAWN) {
      throw new BadRequestException('This complaint has already been withdrawn');
    }

    const shouldDecrementActive =
      complaint.status === ComplaintStatus.OPEN ||
      complaint.status === ComplaintStatus.UNDER_REVIEW;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          status: ComplaintStatus.WITHDRAWN,
          adminNotes: dto.reason ?? null,
        },
      });

      if (shouldDecrementActive) {
        const provider = await tx.provider.findUniqueOrThrow({
          where: { id: complaint.providerId },
          select: { activeComplaints: true },
        });
        await tx.provider.update({
          where: { id: complaint.providerId },
          data: {
            activeComplaints: Math.max(0, provider.activeComplaints - 1),
          },
        });
      }

      return updated;
    });
  }

  async getAllComplaints(
    dto: GetComplaintsDto,
  ): Promise<{ items: ComplaintAdminListItem[]; total: number }> {
    const take = dto.take ?? DEFAULT_GET_COMPLAINTS_TAKE;
    const skip = dto.skip ?? DEFAULT_GET_COMPLAINTS_SKIP;
    const sort = dto.sort ?? 'recent';
    const orderDir = sort === 'oldest' ? 'asc' : 'desc';

    const where: Prisma.ComplaintWhereInput = {
      ...(dto.status != null ? { status: dto.status } : {}),
      ...(dto.category != null ? { category: dto.category } : {}),
      ...(dto.providerId != null ? { providerId: dto.providerId } : {}),
      ...(dto.clientId != null ? { clientId: dto.clientId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: orderDir },
        include: COMPLAINT_ADMIN_LIST_INCLUDE,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    const items: ComplaintAdminListItem[] = rows.map((row) => {
      const { appointment, ...rest } = row;
      const ap = appointment as AppointmentAdminListPayload;
      return {
        ...rest,
        appointment: {
          ...ap,
          serviceName: pickServiceNameFromAppointment(ap),
        },
      };
    });

    return { items, total };
  }

  async reviewComplaint(
    adminUserId: string,
    complaintId: string,
    dto: ReviewComplaintDto,
  ): Promise<Complaint> {
    const platformAdmin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminUserId },
    });
    if (!platformAdmin) {
      throw new ForbiddenException('Only platform administrators can review complaints');
    }

    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        provider: { include: { user: true } },
        client: { include: { user: true } },
        appointment: true,
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    const prevStatus = complaint.status;
    const now = new Date();

    const transitioningFromOpen =
      prevStatus === ComplaintStatus.OPEN && dto.status !== ComplaintStatus.OPEN;

    const closingNow =
      (dto.status === ComplaintStatus.RESOLVED || dto.status === ComplaintStatus.DISMISSED) &&
      prevStatus !== ComplaintStatus.RESOLVED &&
      prevStatus !== ComplaintStatus.DISMISSED;

    const adminNotes =
      dto.adminNotes !== undefined ? dto.adminNotes : complaint.adminNotes;
    const adminResponse =
      dto.adminResponse !== undefined ? dto.adminResponse : complaint.adminResponse;
    const decision =
      dto.decision !== undefined ? dto.decision : complaint.decision;

    const reviewedAt = transitioningFromOpen ? now : complaint.reviewedAt;
    const resolvedAt =
      dto.status === ComplaintStatus.RESOLVED || dto.status === ComplaintStatus.DISMISSED
        ? now
        : complaint.resolvedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          handledByAdminId: platformAdmin.id,
          status: dto.status,
          adminNotes,
          adminResponse,
          decision,
          reviewedAt,
          resolvedAt,
        },
      });

      if (closingNow) {
        const provider = await tx.provider.findUniqueOrThrow({
          where: { id: complaint.providerId },
          select: { activeComplaints: true },
        });
        await tx.provider.update({
          where: { id: complaint.providerId },
          data: {
            activeComplaints: Math.max(0, provider.activeComplaints - 1),
          },
        });
      }

      if (dto.decision === ComplaintDecision.ACCOUNT_SUSPENDED) {
        await tx.user.update({
          where: { id: complaint.provider.user.id },
          data: { status: AccountStatus.SUSPENDED },
        });
      }

      if (dto.decision === ComplaintDecision.ACCOUNT_BANNED) {
        await tx.user.update({
          where: { id: complaint.provider.user.id },
          data: {
            status: AccountStatus.DELETED,
            deletedAt: now,
          },
        });
      }

      return row;
    });

    const notifType =
      dto.status === ComplaintStatus.RESOLVED
        ? NotificationType.COMPLAINT_RESOLVED
        : dto.status === ComplaintStatus.DISMISSED
          ? NotificationType.COMPLAINT_DISMISSED
          : NotificationType.COMPLAINT_STATUS_UPDATED;

    void this.notificationsService.send({
      userId: complaint.client.user.id,
      type: notifType,
      title: this.getClientNotifTitle(dto.status),
      body: dto.adminResponse ?? this.getDefaultClientMessage(dto.status),
      data: { complaintId: complaintId, screen: 'ClientComplaintDetail' },
    });

    if (dto.decision != null) {
      void this.notificationsService.send({
        userId: complaint.provider.user.id,
        type: NotificationType.COMPLAINT_STATUS_UPDATED,
        title: this.getProviderDecisionTitle(dto.decision),
        body: this.getProviderDecisionMessage(dto.decision),
        data: { complaintId: complaintId, screen: 'ProviderComplaints' },
      });
    }

    return updated;
  }

  private getCategoryLabel(category: ComplaintCategory): string {
    const labels: Record<ComplaintCategory, string> = {
      [ComplaintCategory.SERVICE_QUALITY]: 'Service quality issue',
      [ComplaintCategory.NO_SHOW]: 'Provider did not show up',
      [ComplaintCategory.LATE_ARRIVAL]: 'Late arrival',
      [ComplaintCategory.UNPROFESSIONAL]: 'Unprofessional behaviour',
      [ComplaintCategory.OVERCHARGING]: 'Overcharging',
      [ComplaintCategory.PROPERTY_DAMAGE]: 'Property damage',
      [ComplaintCategory.SAFETY_CONCERN]: 'Safety concern',
      [ComplaintCategory.FRAUD]: 'Fraudulent activity',
      [ComplaintCategory.OTHER]: 'Other issue',
    };
    return labels[category] ?? 'Other issue';
  }

  private getClientNotifTitle(status: ComplaintStatus): string {
    switch (status) {
      case ComplaintStatus.RESOLVED:
        return 'Your complaint has been resolved ✓';
      case ComplaintStatus.DISMISSED:
        return 'Complaint update';
      case ComplaintStatus.UNDER_REVIEW:
        return 'Your complaint is under review';
      default:
        return 'Complaint update';
    }
  }

  private getDefaultClientMessage(status: ComplaintStatus): string {
    switch (status) {
      case ComplaintStatus.RESOLVED:
        return 'We have reviewed your complaint and taken appropriate action. Thank you for your feedback.';
      case ComplaintStatus.DISMISSED:
        return 'After investigation, we were unable to substantiate this complaint. Please contact support if you have additional information.';
      case ComplaintStatus.UNDER_REVIEW:
        return 'Our team is actively reviewing your complaint. We will update you shortly.';
      default:
        return 'Your complaint status has been updated.';
    }
  }

  private getProviderDecisionTitle(decision: ComplaintDecision): string {
    switch (decision) {
      case ComplaintDecision.WARNING_ISSUED:
        return '⚠️ Formal warning issued';
      case ComplaintDecision.ACCOUNT_SUSPENDED:
        return 'Account suspended';
      case ComplaintDecision.ACCOUNT_BANNED:
        return 'Account terminated';
      case ComplaintDecision.NO_ACTION:
        return 'Complaint reviewed — no action';
      case ComplaintDecision.REFUND_ISSUED:
        return 'Complaint resolved';
      case ComplaintDecision.FORWARDED_TO_COMPANY:
        return 'Complaint forwarded to your company';
      default:
        return 'Complaint update';
    }
  }

  private getProviderDecisionMessage(decision: ComplaintDecision): string {
    switch (decision) {
      case ComplaintDecision.WARNING_ISSUED:
        return 'You have received a formal warning following a client complaint. Further violations may result in suspension.';
      case ComplaintDecision.ACCOUNT_SUSPENDED:
        return 'Your account has been temporarily suspended following a client complaint. Contact support to appeal.';
      case ComplaintDecision.ACCOUNT_BANNED:
        return 'Your account has been terminated following a serious complaint.';
      case ComplaintDecision.NO_ACTION:
        return 'A complaint filed against you was reviewed and dismissed. No action was taken.';
      case ComplaintDecision.REFUND_ISSUED:
        return 'A resolution has been reached on a client complaint.';
      case ComplaintDecision.FORWARDED_TO_COMPANY:
        return 'A client complaint has been forwarded to your company administrator.';
      default:
        return 'A complaint against you has been updated.';
    }
  }
}
