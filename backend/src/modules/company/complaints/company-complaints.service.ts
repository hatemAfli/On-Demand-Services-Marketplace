import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintForwardTarget,
  ComplaintStatus,
  Locale,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { NotificationsService } from '../../notifications/notifications.service';
import { ListCompanyComplaintsDto } from './dto/list-company-complaints.dto';
import { ReviewCompanyComplaintDto } from './dto/review-company-complaint.dto';

const DEFAULT_TAKE = 20;
const DEFAULT_SKIP = 0;

const APPOINTMENT_SELECT = {
  id: true,
  scheduledDate: true,
  scheduledTime: true,
  givenService: {
    select: {
      service: {
        select: {
          translations: {
            where: { locale: Locale.EN },
            select: { name: true },
          },
        },
      },
    },
  },
} satisfies Prisma.AppointmentSelect;

const LIST_INCLUDE = {
  client: {
    select: {
      imageUrl: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  provider: {
    select: {
      photoUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  appointment: { select: APPOINTMENT_SELECT },
} satisfies Prisma.ComplaintInclude;

function pickServiceName(
  appointment: Prisma.AppointmentGetPayload<{ select: typeof APPOINTMENT_SELECT }>,
): string {
  return (
    appointment.givenService?.service?.translations?.[0]?.name?.trim() ||
    'Service'
  );
}

@Injectable()
export class CompanyComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
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

  private companyComplaintScope(companyId: string): Prisma.ComplaintWhereInput {
    return {
      companyId,
      forwardTarget: {
        in: [ComplaintForwardTarget.COMPANY, ComplaintForwardTarget.BOTH],
      },
    };
  }

  private async assertCompanyComplaint(
    companyAdminUserId: string,
    complaintId: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const complaint = await this.prisma.complaint.findFirst({
      where: {
        id: complaintId,
        ...this.companyComplaintScope(companyId),
      },
      include: {
        client: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        provider: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        appointment: { select: APPOINTMENT_SELECT },
      },
    });
    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }
    return { companyId, complaint };
  }

  async getStats(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const scope = this.companyComplaintScope(companyId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [total, open, underReview, resolvedThisMonth] = await Promise.all([
      this.prisma.complaint.count({ where: scope }),
      this.prisma.complaint.count({
        where: { ...scope, status: ComplaintStatus.OPEN },
      }),
      this.prisma.complaint.count({
        where: { ...scope, status: ComplaintStatus.UNDER_REVIEW },
      }),
      this.prisma.complaint.count({
        where: {
          ...scope,
          status: ComplaintStatus.RESOLVED,
          resolvedAt: { gte: monthStart },
        },
      }),
    ]);

    return { total, open, underReview, resolvedThisMonth };
  }

  async list(companyAdminUserId: string, dto: ListCompanyComplaintsDto) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const take = dto.take ?? DEFAULT_TAKE;
    const skip = dto.skip ?? DEFAULT_SKIP;
    const orderDir = dto.sort === 'oldest' ? 'asc' : 'desc';

    const where: Prisma.ComplaintWhereInput = {
      ...this.companyComplaintScope(companyId),
      ...(dto.status != null ? { status: dto.status } : {}),
      ...(dto.category != null ? { category: dto.category } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: orderDir },
        include: LIST_INCLUDE,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    const items = rows.map((row) => {
      const ap = row.appointment;
      const sdRaw = ap.scheduledDate as unknown;
      const scheduledDate =
        sdRaw instanceof Date
          ? sdRaw.toISOString().slice(0, 10)
          : String(sdRaw ?? '').slice(0, 10);
      return {
        ...row,
        appointment: {
          ...ap,
          scheduledDate,
          serviceName: pickServiceName(ap),
        },
      };
    });

    return { items, total };
  }

  async getById(companyAdminUserId: string, complaintId: string) {
    const { complaint } = await this.assertCompanyComplaint(
      companyAdminUserId,
      complaintId,
    );
    const ap = complaint.appointment;
    const sdRaw = ap.scheduledDate as unknown;
    const scheduledDate =
      sdRaw instanceof Date
        ? sdRaw.toISOString().slice(0, 10)
        : String(sdRaw ?? '').slice(0, 10);
    return {
      ...complaint,
      appointment: {
        ...ap,
        scheduledDate,
        serviceName: pickServiceName(ap),
      },
    };
  }

  async review(
    companyAdminUserId: string,
    complaintId: string,
    dto: ReviewCompanyComplaintDto,
  ) {
    const allowed: ComplaintStatus[] = [
      ComplaintStatus.UNDER_REVIEW,
      ComplaintStatus.RESOLVED,
      ComplaintStatus.DISMISSED,
    ];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Invalid status for company review');
    }

    const { complaint } = await this.assertCompanyComplaint(
      companyAdminUserId,
      complaintId,
    );

    if (
      complaint.status === ComplaintStatus.RESOLVED ||
      complaint.status === ComplaintStatus.DISMISSED ||
      complaint.status === ComplaintStatus.WITHDRAWN
    ) {
      throw new BadRequestException('This complaint is already closed');
    }

    const prevStatus = complaint.status;
    const now = new Date();
    const transitioningFromOpen = prevStatus === ComplaintStatus.OPEN;
    const closingNow =
      dto.status === ComplaintStatus.RESOLVED ||
      dto.status === ComplaintStatus.DISMISSED;

    const companyOnly =
      complaint.forwardTarget === ComplaintForwardTarget.COMPANY;

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.complaint.update({
        where: { id: complaintId },
        data: {
          companyNotes:
            dto.companyNotes !== undefined
              ? dto.companyNotes
              : complaint.companyNotes,
          companyResponse:
            dto.companyResponse !== undefined
              ? dto.companyResponse
              : complaint.companyResponse,
          companyReviewedAt: now,
          ...(companyOnly
            ? {
                status: dto.status,
                reviewedAt: transitioningFromOpen ? now : complaint.reviewedAt,
                resolvedAt: closingNow ? now : complaint.resolvedAt,
              }
            : complaint.forwardTarget === ComplaintForwardTarget.BOTH &&
                dto.status === ComplaintStatus.UNDER_REVIEW
              ? {
                  reviewedAt: transitioningFromOpen ? now : complaint.reviewedAt,
                }
              : {}),
        },
      });

      if (closingNow && companyOnly) {
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

      return row;
    });

    const companyOnlyClosed =
      companyOnly &&
      (dto.status === ComplaintStatus.RESOLVED ||
        dto.status === ComplaintStatus.DISMISSED);

    const notifType = companyOnlyClosed
      ? dto.status === ComplaintStatus.RESOLVED
        ? NotificationType.COMPLAINT_RESOLVED
        : NotificationType.COMPLAINT_DISMISSED
      : NotificationType.COMPLAINT_STATUS_UPDATED;

    const clientTitle = companyOnlyClosed
      ? dto.status === ComplaintStatus.RESOLVED
        ? 'Your complaint has been resolved'
        : 'Complaint update from your company'
      : 'Update from your provider\'s company';

    void this.notificationsService.send({
      userId: complaint.client.user.id,
      type: notifType,
      title: clientTitle,
      body:
        dto.companyResponse?.trim() ||
        (companyOnly
          ? 'Your company has updated the status of your complaint.'
          : 'Your provider\'s company has added a response to your complaint.'),
      data: { complaintId, screen: 'ClientComplaintDetail' },
    });

    return updated;
  }
}
