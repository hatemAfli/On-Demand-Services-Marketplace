import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyAuditAction,
  CompanyBranchStatus,
  DashboardTheme,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { UpdateCompanyBrandingDto } from './dto/update-company-branding.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpsertBranchDto } from './dto/upsert-branch.dto';

const BRANCH_STATUS_LABEL: Record<CompanyBranchStatus, string> = {
  OPERATIONAL: 'Operational',
  COMING_SOON: 'Coming Soon',
  INACTIVE: 'Inactive',
};

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCompanyAdmin(userId: string) {
    const companyAdmin = await this.prisma.companyAdmin.findUnique({
      where: { id: userId },
      include: {
        company: true,
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });
    if (!companyAdmin?.company) {
      throw new NotFoundException('Company admin account not found.');
    }
    return companyAdmin as typeof companyAdmin & {
      company: NonNullable<typeof companyAdmin.company>;
    };
  }

  private async ensureDefaultBranch(companyId: string) {
    const count = await this.prisma.companyBranch.count({
      where: { companyId },
    });
    if (count > 0) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { companyName: true, city: true, address: true },
    });
    if (!company) return;

    await this.prisma.companyBranch.create({
      data: {
        companyId,
        name: `${company.companyName} HQ`,
        subtitle: 'Main Office',
        city: company.city,
        address: company.address,
        status: CompanyBranchStatus.OPERATIONAL,
      },
    });
  }

  private async ensureNotificationPrefs(companyAdminId: string) {
    return this.prisma.companyNotificationPreference.upsert({
      where: { companyAdminId },
      create: { companyAdminId },
      update: {},
    });
  }

  private async logAudit(
    companyId: string,
    actorAdminId: string,
    action: CompanyAuditAction,
    summary: string,
    metadata?: Prisma.InputJsonValue,
    ipAddress?: string,
  ) {
    await this.prisma.companyAuditLog.create({
      data: {
        companyId,
        actorAdminId,
        action,
        summary,
        metadata,
        ipAddress,
      },
    });
  }

  private mapProfile(company: {
    companyName: string;
    taxId: string;
    email: string | null;
    phone: string | null;
    city: string;
    address: string | null;
    about: string | null;
    serviceZones: string[];
    logo: string | null;
    brandColor: string | null;
    dashboardTheme: DashboardTheme;
  }) {
    return {
      companyName: company.companyName,
      taxId: company.taxId,
      email: company.email ?? '',
      phone: company.phone ?? '',
      city: company.city,
      address: company.address ?? '',
      about: company.about ?? '',
      serviceZones: company.serviceZones ?? [],
      logo: company.logo,
      brandColor: company.brandColor ?? '#7621C2',
      dashboardTheme: company.dashboardTheme,
    };
  }

  async getSettings(userId: string) {
    const admin = await this.resolveCompanyAdmin(userId);
    await this.ensureDefaultBranch(admin.companyId);
    const [company, branches, notifications, auditPreview, employeeCount] =
      await Promise.all([
        this.prisma.company.findUniqueOrThrow({
          where: { id: admin.companyId },
        }),
        this.listBranchesInternal(admin.companyId),
        this.ensureNotificationPrefs(admin.id),
        this.prisma.companyAuditLog.findMany({
          where: { companyId: admin.companyId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            actorAdmin: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        this.prisma.provider.count({
          where: { companyId: admin.companyId, type: ProviderType.EMPLOYEE },
        }),
      ]);

    return {
      profile: this.mapProfile(company),
      branches,
      notifications: {
        newOrderAlerts: notifications.newOrderAlerts,
        providerStatusUpdates: notifications.providerStatusUpdates,
        weeklyReport: notifications.weeklyReport,
        systemAnnouncements: notifications.systemAnnouncements,
      },
      team: {
        members: [
          {
            id: admin.user.id,
            name: `${admin.user.firstName ?? ''} ${admin.user.lastName ?? ''}`.trim() ||
              admin.user.email,
            email: admin.user.email,
            status: admin.user.status,
            role: 'Owner',
            phoneNumber: admin.user.phoneNumber,
          },
        ],
        employeeCount,
        multiAdminSupported: false,
      },
      auditPreview: auditPreview.map((log) => this.mapAuditLog(log)),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateCompanyProfileDto,
    ipAddress?: string,
  ) {
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('No data to update');
    }
    const admin = await this.resolveCompanyAdmin(userId);

    const company = await this.prisma.company.update({
      where: { id: admin.companyId },
      data: {
        ...(dto.companyName !== undefined
          ? { companyName: dto.companyName.trim() }
          : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.address !== undefined
          ? { address: dto.address.trim() || null }
          : {}),
        ...(dto.about !== undefined ? { about: dto.about.trim() || null } : {}),
      },
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.PROFILE_UPDATED,
      `${admin.user.firstName ?? 'Admin'} updated company profile.`,
      { fields: Object.keys(dto) },
      ipAddress,
    );

    return this.mapProfile(company);
  }

  async updateBranding(
    userId: string,
    dto: UpdateCompanyBrandingDto,
    ipAddress?: string,
  ) {
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('No data to update');
    }
    const admin = await this.resolveCompanyAdmin(userId);

    const company = await this.prisma.company.update({
      where: { id: admin.companyId },
      data: {
        ...(dto.logo !== undefined ? { logo: dto.logo?.trim() || null } : {}),
        ...(dto.brandColor !== undefined
          ? { brandColor: dto.brandColor.trim() }
          : {}),
        ...(dto.dashboardTheme !== undefined
          ? { dashboardTheme: dto.dashboardTheme }
          : {}),
      },
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.BRANDING_UPDATED,
      `${admin.user.firstName ?? 'Admin'} updated company branding.`,
      { fields: Object.keys(dto) },
      ipAddress,
    );

    return {
      logo: company.logo,
      brandColor: company.brandColor ?? '#7621C2',
      dashboardTheme: company.dashboardTheme,
    };
  }

  private async listBranchesInternal(companyId: string) {
    const [branches, employees] = await Promise.all([
      this.prisma.companyBranch.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.provider.findMany({
        where: { companyId, type: ProviderType.EMPLOYEE },
        select: { city: true },
      }),
    ]);

    return branches.map((b) => {
      const cityKey = b.city.trim().toLowerCase();
      const activeProviders = employees.filter(
        (e) => e.city.trim().toLowerCase() === cityKey,
      ).length;
      return {
        id: b.id,
        name: b.name,
        subtitle: b.subtitle,
        city: b.city,
        address: b.address,
        status: b.status,
        statusLabel: BRANCH_STATUS_LABEL[b.status],
        activeProviders,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });
  }

  async listBranches(userId: string) {
    const admin = await this.resolveCompanyAdmin(userId);
    await this.ensureDefaultBranch(admin.companyId);
    return this.listBranchesInternal(admin.companyId);
  }

  async createBranch(
    userId: string,
    dto: UpsertBranchDto,
    ipAddress?: string,
  ) {
    const admin = await this.resolveCompanyAdmin(userId);
    const branch = await this.prisma.companyBranch.create({
      data: {
        companyId: admin.companyId,
        name: dto.name.trim(),
        subtitle: dto.subtitle?.trim() || null,
        city: dto.city.trim(),
        address: dto.address?.trim() || null,
        status: dto.status ?? CompanyBranchStatus.OPERATIONAL,
      },
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.BRANCH_CREATED,
      `${admin.user.firstName ?? 'Admin'} created branch "${branch.name}".`,
      { branchId: branch.id },
      ipAddress,
    );

    const mapped = (await this.listBranchesInternal(admin.companyId)).find(
      (b) => b.id === branch.id,
    );
    return mapped!;
  }

  async updateBranch(
    userId: string,
    branchId: string,
    dto: UpsertBranchDto,
    ipAddress?: string,
  ) {
    const admin = await this.resolveCompanyAdmin(userId);
    const existing = await this.prisma.companyBranch.findFirst({
      where: { id: branchId, companyId: admin.companyId },
    });
    if (!existing) throw new NotFoundException('Branch not found');

    await this.prisma.companyBranch.update({
      where: { id: branchId },
      data: {
        name: dto.name.trim(),
        subtitle: dto.subtitle?.trim() || null,
        city: dto.city.trim(),
        address: dto.address?.trim() || null,
        status: dto.status ?? existing.status,
      },
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.BRANCH_UPDATED,
      `${admin.user.firstName ?? 'Admin'} updated branch "${dto.name.trim()}".`,
      { branchId },
      ipAddress,
    );

    const mapped = (await this.listBranchesInternal(admin.companyId)).find(
      (b) => b.id === branchId,
    );
    return mapped!;
  }

  async deleteBranch(userId: string, branchId: string, ipAddress?: string) {
    const admin = await this.resolveCompanyAdmin(userId);
    const existing = await this.prisma.companyBranch.findFirst({
      where: { id: branchId, companyId: admin.companyId },
    });
    if (!existing) throw new NotFoundException('Branch not found');

    const branchCount = await this.prisma.companyBranch.count({
      where: { companyId: admin.companyId },
    });
    if (branchCount <= 1) {
      throw new BadRequestException('At least one branch must remain.');
    }

    await this.prisma.companyBranch.delete({ where: { id: branchId } });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.BRANCH_DELETED,
      `${admin.user.firstName ?? 'Admin'} deleted branch "${existing.name}".`,
      { branchId },
      ipAddress,
    );

    return { deleted: true };
  }

  async updateNotifications(
    userId: string,
    dto: UpdateNotificationsDto,
    ipAddress?: string,
  ) {
    if (!dto || Object.keys(dto).length === 0) {
      throw new BadRequestException('No data to update');
    }
    const admin = await this.resolveCompanyAdmin(userId);
    await this.ensureNotificationPrefs(admin.id);

    const prefs = await this.prisma.companyNotificationPreference.update({
      where: { companyAdminId: admin.id },
      data: {
        ...(dto.newOrderAlerts !== undefined
          ? { newOrderAlerts: dto.newOrderAlerts }
          : {}),
        ...(dto.providerStatusUpdates !== undefined
          ? { providerStatusUpdates: dto.providerStatusUpdates }
          : {}),
        ...(dto.weeklyReport !== undefined
          ? { weeklyReport: dto.weeklyReport }
          : {}),
        ...(dto.systemAnnouncements !== undefined
          ? { systemAnnouncements: dto.systemAnnouncements }
          : {}),
      },
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.NOTIFICATION_UPDATED,
      `${admin.user.firstName ?? 'Admin'} updated notification preferences.`,
      { fields: Object.keys(dto) },
      ipAddress,
    );

    return {
      newOrderAlerts: prefs.newOrderAlerts,
      providerStatusUpdates: prefs.providerStatusUpdates,
      weeklyReport: prefs.weeklyReport,
      systemAnnouncements: prefs.systemAnnouncements,
    };
  }

  async listAuditLogs(userId: string, dto: ListAuditLogsDto) {
    const admin = await this.resolveCompanyAdmin(userId);
    const take = dto.take ?? 20;
    const skip = dto.skip ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.companyAuditLog.findMany({
        where: { companyId: admin.companyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          actorAdmin: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.companyAuditLog.count({
        where: { companyId: admin.companyId },
      }),
    ]);

    return {
      items: items.map((log) => this.mapAuditLog(log)),
      total,
      skip,
      take,
    };
  }

  private mapAuditLog(log: {
    id: string;
    action: CompanyAuditAction;
    summary: string;
    ipAddress: string | null;
    createdAt: Date;
    actorAdmin: {
      user: { firstName: string; lastName: string };
    } | null;
  }) {
    const actorName = log.actorAdmin?.user
      ? `${log.actorAdmin.user.firstName ?? ''} ${log.actorAdmin.user.lastName ?? ''}`.trim()
      : 'System';
    return {
      id: log.id,
      action: log.action,
      summary: log.summary,
      actorName: actorName || 'System',
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      displayId: `#LOG-${log.id.slice(0, 8).toUpperCase()}`,
    };
  }

  private csvEscape(value: unknown): string {
    const str = value == null ? '' : String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  async exportProvidersCsv(userId: string, ipAddress?: string): Promise<string> {
    const admin = await this.resolveCompanyAdmin(userId);
    const rows = await this.prisma.provider.findMany({
      where: { companyId: admin.companyId, type: ProviderType.EMPLOYEE },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = [
      'Provider ID',
      'First Name',
      'Last Name',
      'Email',
      'City',
      'Status',
      'Average Rating',
      'Total Reviews',
    ].join(',');

    const lines = rows.map((p) =>
      [
        p.id,
        p.user.firstName,
        p.user.lastName,
        p.user.email,
        p.city,
        p.user.status,
        Number(p.averageRating ?? 0).toFixed(2),
        p.totalReviews,
      ]
        .map((v) => this.csvEscape(v))
        .join(','),
    );

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.DATA_EXPORT,
      `${admin.user.firstName ?? 'Admin'} exported providers CSV.`,
      { type: 'providers' },
      ipAddress,
    );

    return [header, ...lines].join('\n');
  }

  async exportOrdersCsv(userId: string, ipAddress?: string): Promise<string> {
    const admin = await this.resolveCompanyAdmin(userId);
    const rows = await this.prisma.appointment.findMany({
      where: { companyId: admin.companyId },
      include: {
        client: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
        provider: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        givenService: {
          include: {
            service: { include: { translations: true } },
          },
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    const header = [
      'Appointment ID',
      'Status',
      'Scheduled Date',
      'Scheduled Time',
      'Client',
      'Provider',
      'Service',
      'Price',
      'Pricing Type',
    ].join(',');

    const lines = rows.map((a) => {
      const serviceName =
        a.givenService.service.translations[0]?.name ?? 'Service';
      const clientName = `${a.client.user.firstName ?? ''} ${a.client.user.lastName ?? ''}`.trim();
      const providerName = a.provider
        ? `${a.provider.user.firstName ?? ''} ${a.provider.user.lastName ?? ''}`.trim()
        : '';
      return [
        a.id,
        a.status,
        a.scheduledDate.toISOString().slice(0, 10),
        a.scheduledTime,
        clientName,
        providerName,
        serviceName,
        a.givenService.price != null ? Number(a.givenService.price) : '',
        a.givenService.pricingType,
      ]
        .map((v) => this.csvEscape(v))
        .join(',');
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.DATA_EXPORT,
      `${admin.user.firstName ?? 'Admin'} exported orders CSV.`,
      { type: 'orders' },
      ipAddress,
    );

    return [header, ...lines].join('\n');
  }

  async exportSummaryCsv(userId: string, ipAddress?: string): Promise<string> {
    const admin = await this.resolveCompanyAdmin(userId);
    const companyId = admin.companyId;

    const [company, byStatus, employeeCount, reviewStats] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.provider.count({
        where: { companyId, type: ProviderType.EMPLOYEE },
      }),
      this.prisma.review.aggregate({
        where: {
          provider: { companyId, type: ProviderType.EMPLOYEE },
        },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const completed = byStatus.find((s) => s.status === 'COMPLETED')?._count._all ?? 0;
    const total = byStatus.reduce((s, r) => s + r._count._all, 0);

    const lines = [
      'Metric,Value',
      `Company Name,${this.csvEscape(company.companyName)}`,
      `Generated At,${this.csvEscape(new Date().toISOString())}`,
      `Total Appointments,${total}`,
      `Completed Appointments,${completed}`,
      `Active Employees,${employeeCount}`,
      `Company Rating,${Number(company.averageRating ?? 0).toFixed(2)}`,
      `Total Reviews,${company.totalReviews}`,
      `Average Review Score,${reviewStats._avg.rating != null ? reviewStats._avg.rating.toFixed(2) : '0'}`,
    ];

    await this.logAudit(
      companyId,
      admin.id,
      CompanyAuditAction.DATA_EXPORT,
      `${admin.user.firstName ?? 'Admin'} exported financial summary.`,
      { type: 'summary' },
      ipAddress,
    );

    return lines.join('\n');
  }

  async exportAuditLogsCsv(userId: string, ipAddress?: string): Promise<string> {
    const admin = await this.resolveCompanyAdmin(userId);
    const logs = await this.prisma.companyAuditLog.findMany({
      where: { companyId: admin.companyId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        actorAdmin: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const header = 'Log ID,Action,Summary,Actor,IP Address,Created At';
    const lines = logs.map((log) => {
      const mapped = this.mapAuditLog(log);
      return [
        mapped.displayId,
        mapped.action,
        mapped.summary,
        mapped.actorName,
        mapped.ipAddress ?? '',
        mapped.createdAt.toISOString(),
      ]
        .map((v) => this.csvEscape(v))
        .join(',');
    });

    await this.logAudit(
      admin.companyId,
      admin.id,
      CompanyAuditAction.DATA_EXPORT,
      `${admin.user.firstName ?? 'Admin'} exported audit logs.`,
      { type: 'audit' },
      ipAddress,
    );

    return [header, ...lines].join('\n');
  }
}
