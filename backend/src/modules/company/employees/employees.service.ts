import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeInvitation,
  InvitationStatus,
  CompanyAuditAction,
  NotificationType,
  Provider,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { AvailabilityService } from '../../availability/availability.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CompanyAuditService } from '../audit/company-audit.service';
import { GetEmployeesDto } from './dto/get-employees.dto';
import { InviteProviderDto } from './dto/invite-provider.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly availabilityService: AvailabilityService,
    private readonly audit: CompanyAuditService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Resolve the CompanyAdmin row for a given user id, including its company. */
  private async resolveCompanyAdmin(userId: string) {
    const companyAdmin = await this.prisma.companyAdmin.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!companyAdmin || !companyAdmin.company) {
      throw new NotFoundException('Company admin account not found.');
    }
    // company is guaranteed non-null after the guard above
    return companyAdmin as typeof companyAdmin & {
      company: NonNullable<typeof companyAdmin.company>;
    };
  }

  // ─── lookupProviderByEmail ───────────────────────────────────────────────────

  async lookupProviderByEmail(email: string): Promise<{
    id: string;
    userId: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    city: string;
    averageRating: number;
    totalReviews: number;
    type: ProviderType;
    companyId: string | null;
    isTopProvider: boolean;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { email, role: 'PROVIDER' },
      include: { provider: true },
    });

    if (!user || !user.provider) {
      throw new NotFoundException(
        'No provider account found with this email address.',
      );
    }

    const p = user.provider;

    if (p.type === ProviderType.EMPLOYEE) {
      throw new ConflictException(
        'This provider is already employed by a company.',
      );
    }

    return {
      id: p.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: p.photoUrl,
      city: p.city,
      averageRating: p.averageRating ? Number(p.averageRating) : 0,
      totalReviews: p.totalReviews,
      type: p.type,
      companyId: p.companyId,
      isTopProvider: p.isTopProvider,
    };
  }

  // ─── sendInvitation ──────────────────────────────────────────────────────────

  async sendInvitation(
    companyAdminUserId: string,
    dto: InviteProviderDto,
    ipAddress?: string,
  ): Promise<EmployeeInvitation> {
    const companyAdmin = await this.resolveCompanyAdmin(companyAdminUserId);
    const { company } = companyAdmin;
    const companyId = company.id;

    const provider = await this.lookupProviderByEmail(dto.email);

    // Check for existing PENDING invitation
    const existing = await this.prisma.employeeInvitation.findFirst({
      where: { companyId, providerId: provider.id, status: 'PENDING' },
    });
    if (existing) {
      throw new ConflictException(
        'A pending invitation already exists for this provider.',
      );
    }

    // Check provider is not already in this company
    if (provider.companyId === companyId) {
      throw new ConflictException(
        'This provider is already a member of your team.',
      );
    }

    const invitation = await this.prisma.employeeInvitation.create({
      data: {
        companyId,
        sentByAdminId: companyAdmin.id,
        providerId: provider.id,
        message: dto.message,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Fire-and-forget notification to provider
    void this.notificationsService.send({
      userId: provider.userId,
      type: NotificationType.EMPLOYEE_INVITATION_RECEIVED,
      title: '📩 You have a new job invitation',
      body: `${company.companyName} has invited you to join their team. Tap to review the invitation.`,
      data: {
        invitationId: invitation.id,
        companyId,
        screen: 'ProviderInvitationsScreen',
      },
    });

    const actor = await this.audit.actorFirstName(companyAdmin.id);
    await this.audit.log(
      companyId,
      companyAdmin.id,
      CompanyAuditAction.EMPLOYEE_INVITED,
      `${actor} invited ${provider.firstName} ${provider.lastName} (${dto.email}) to join the team.`,
      { invitationId: invitation.id, providerId: provider.id, email: dto.email },
      ipAddress,
    );

    return invitation;
  }

  // ─── cancelInvitation ────────────────────────────────────────────────────────

  async cancelInvitation(
    companyAdminUserId: string,
    invitationId: string,
    ipAddress?: string,
  ): Promise<void> {
    const companyAdmin = await this.resolveCompanyAdmin(companyAdminUserId);
    const companyId = companyAdmin.company.id;

    const invitation = await this.prisma.employeeInvitation.findFirst({
      where: { id: invitationId, companyId },
      include: { provider: { include: { user: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending invitations can be cancelled.',
      );
    }

    await this.prisma.employeeInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.CANCELLED },
    });

    // Fire-and-forget notification to provider
    void this.notificationsService.send({
      userId: invitation.provider.user.id,
      type: NotificationType.EMPLOYEE_INVITATION_CANCELLED,
      title: 'Invitation cancelled',
      body: `${companyAdmin.company.companyName} has cancelled their invitation.`,
      data: { invitationId, screen: 'ProviderInvitationsScreen' },
    });

    const providerName =
      `${invitation.provider.user.firstName ?? ''} ${invitation.provider.user.lastName ?? ''}`.trim() ||
      'provider';
    const actor = await this.audit.actorFirstName(companyAdmin.id);
    await this.audit.log(
      companyId,
      companyAdmin.id,
      CompanyAuditAction.EMPLOYEE_INVITATION_CANCELLED,
      `${actor} cancelled the invitation sent to ${providerName}.`,
      { invitationId, providerId: invitation.providerId },
      ipAddress,
    );
  }

  // ─── getMyInvitations (company admin — all sent) ─────────────────────────────

  async getMyInvitations(
    companyAdminUserId: string,
    status?: InvitationStatus,
  ): Promise<EmployeeInvitation[]> {
    const companyAdmin = await this.resolveCompanyAdmin(companyAdminUserId);
    const companyId = companyAdmin.company.id;

    return this.prisma.employeeInvitation.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      include: {
        provider: {
          select: {
            id: true,
            photoUrl: true,
            city: true,
            averageRating: true,
            totalReviews: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        sentByAdmin: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── getMyReceivedInvitations (provider) ─────────────────────────────────────

  async getMyReceivedInvitations(
    providerUserId: string,
    filter: 'all' | 'pending' | 'cancelled' = 'pending',
  ): Promise<EmployeeInvitation[]> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerUserId },
    });
    if (!provider) {
      throw new NotFoundException('Provider account not found.');
    }

    const where: {
      providerId: string;
      status?: InvitationStatus;
      expiresAt?: { gt: Date };
    } = { providerId: provider.id };

    switch (filter) {
      case 'pending':
        where.status = InvitationStatus.PENDING;
        where.expiresAt = { gt: new Date() };
        break;
      case 'cancelled':
        where.status = InvitationStatus.CANCELLED;
        break;
      case 'all':
      default:
        break;
    }

    return this.prisma.employeeInvitation.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            logo: true,
            city: true,
            averageRating: true,
            totalReviews: true,
          },
        },
        sentByAdmin: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── respondToInvitation (provider) ──────────────────────────────────────────

  async respondToInvitation(
    providerUserId: string,
    invitationId: string,
    dto: RespondInvitationDto,
  ): Promise<void> {
    const invitation = await this.prisma.employeeInvitation.findUnique({
      where: { id: invitationId },
      include: {
        company: true,
        provider: { include: { user: true } },
        sentByAdmin: { include: { user: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }
    if (invitation.provider.user.id !== providerUserId) {
      throw new NotFoundException('Invitation not found.');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'This invitation has already been responded to or cancelled.',
      );
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired.');
    }

    const now = new Date();
    const providerFirstName = invitation.provider.user.firstName;
    const providerLastName = invitation.provider.user.lastName;
    const adminUserId = invitation.sentByAdmin.user.id;

    if (dto.action === 'ACCEPTED') {
      await this.prisma.$transaction([
        this.prisma.employeeInvitation.update({
          where: { id: invitationId },
          data: {
            status: InvitationStatus.ACCEPTED,
            respondedAt: now,
          },
        }),
        this.prisma.provider.update({
          where: { id: invitation.providerId },
          data: {
            type: ProviderType.EMPLOYEE,
            companyId: invitation.companyId,
          },
        }),
      ]);

      await this.availabilityService.ensureDefaultWeeklyAvailabilityIfEmpty(
        invitation.providerId,
      );

      void this.notificationsService.send({
        userId: adminUserId,
        type: NotificationType.EMPLOYEE_INVITATION_ACCEPTED,
        title: '✅ Invitation accepted',
        body: `${providerFirstName} ${providerLastName} has joined your team.`,
        data: {
          providerId: invitation.providerId,
          screen: 'CompanyProvidersPage',
        },
      });
    } else {
      await this.prisma.employeeInvitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.DECLINED,
          respondedAt: now,
        },
      });

      void this.notificationsService.send({
        userId: adminUserId,
        type: NotificationType.EMPLOYEE_INVITATION_DECLINED,
        title: 'Invitation declined',
        body: `${providerFirstName} has declined your invitation.`,
        data: { invitationId, screen: 'CompanyInvitationsPage' },
      });
    }
  }

  // ─── removeEmployee ───────────────────────────────────────────────────────────

  async removeEmployee(
    companyAdminUserId: string,
    providerId: string,
    ipAddress?: string,
  ): Promise<void> {
    const companyAdmin = await this.resolveCompanyAdmin(companyAdminUserId);
    const { company } = companyAdmin;

    const provider = await this.prisma.provider.findFirst({
      where: {
        id: providerId,
        companyId: company.id,
        type: ProviderType.EMPLOYEE,
      },
      include: { user: true },
    });

    if (!provider) {
      throw new NotFoundException(
        'Provider not found in your company.',
      );
    }

    // Block removal if active appointments exist
    const activeCount = await this.prisma.appointment.count({
      where: {
        providerId,
        status: { in: ['CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS'] },
      },
    });
    if (activeCount > 0) {
      throw new ConflictException(
        'Cannot remove a provider with active appointments. Wait for current jobs to complete.',
      );
    }

    await this.prisma.$transaction([
      // Remove from company
      this.prisma.provider.update({
        where: { id: providerId },
        data: { type: ProviderType.INDEPENDENT, companyId: null },
      }),
      // Cancel any remaining PENDING invitations from this company to this provider
      this.prisma.employeeInvitation.updateMany({
        where: {
          companyId: company.id,
          providerId,
          status: InvitationStatus.PENDING,
        },
        data: { status: InvitationStatus.CANCELLED },
      }),
    ]);

    // Fire-and-forget notification
    void this.notificationsService.send({
      userId: provider.user.id,
      type: NotificationType.EMPLOYEE_REMOVED_FROM_COMPANY,
      title: 'You have been removed from a company',
      body: `${company.companyName} has removed you from their team. You are now an independent provider.`,
      data: { companyId: company.id, screen: 'ProviderHomeScreen' },
    });

    const providerName =
      `${provider.user.firstName ?? ''} ${provider.user.lastName ?? ''}`.trim() ||
      'provider';
    const actor = await this.audit.actorFirstName(companyAdmin.id);
    await this.audit.log(
      company.id,
      companyAdmin.id,
      CompanyAuditAction.EMPLOYEE_REMOVED,
      `${actor} removed ${providerName} from the team.`,
      { providerId },
      ipAddress,
    );
  }

  // ─── getCompanyEmployees ──────────────────────────────────────────────────────

  async getCompanyEmployees(
    companyAdminUserId: string,
    dto: GetEmployeesDto,
  ): Promise<{ items: Provider[]; total: number }> {
    const companyAdmin = await this.resolveCompanyAdmin(companyAdminUserId);
    const companyId = companyAdmin.company.id;

    const { search, status, sort = 'recent', take = 20, skip = 0 } = dto;

    const where = {
      companyId,
      type: ProviderType.EMPLOYEE,
      ...(search
        ? {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
      ...(status ? { user: { status } } : {}),
    };

    const orderBy =
      sort === 'name_asc'
        ? { user: { firstName: 'asc' as const } }
        : sort === 'name_desc'
          ? { user: { firstName: 'desc' as const } }
          : sort === 'rating_desc'
            ? { averageRating: 'desc' as const }
            : { createdAt: 'desc' as const }; // 'recent'

    const include = {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          createdAt: true,
        },
      },
      availability: { select: { isWorking: true, dayOfWeek: true } },
      _count: { select: { appointments: true } },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.provider.findMany({ where, orderBy, take, skip, include }) as any,
      this.prisma.provider.count({ where }),
    ]);

    return { items, total };
  }

  // ─── getEmployeeById ──────────────────────────────────────────────────────────

  async getEmployeeById(
    companyAdminUserId: string,
    providerId: string,
  ): Promise<Provider> {
    const companyAdmin = await this.resolveCompanyAdmin(companyAdminUserId);
    const companyId = companyAdmin.company.id;

    const provider = await this.prisma.provider.findFirst({
      where: { id: providerId, companyId, type: ProviderType.EMPLOYEE },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
            status: true,
          },
        },
        availability: true,
        daysOff: {
          where: { date: { gte: new Date() } },
          orderBy: { date: 'asc' },
        },
        reviews: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          include: { client: { include: { user: true } } },
        },
        complaints: {
          where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        },
        appointments: {
          where: { status: { in: ['CONFIRMED', 'EN_ROUTE', 'IN_PROGRESS'] } },
          take: 5,
          include: {
            client: { include: { user: true } },
            givenService: {
              include: {
                service: { include: { translations: true } },
              },
            },
          },
        },
        _count: { select: { appointments: true, reviews: true } },
      },
    });

    if (!provider) {
      throw new NotFoundException('Employee not found in your company.');
    }

    return provider as Provider;
  }

  // ─── expireStaleInvitations (cron helper) ────────────────────────────────────

  async expireStaleInvitations(): Promise<void> {
    const { count } = await this.prisma.employeeInvitation.updateMany({
      where: {
        status: InvitationStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: InvitationStatus.EXPIRED },
    });

    if (count > 0) {
      this.logger.log(`Expired ${count} stale employee invitation(s).`);
    }
  }
}
