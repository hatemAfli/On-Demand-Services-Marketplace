import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  ComplaintForwardTarget,
  ComplaintStatus,
  InvitationStatus,
  Locale,
  OwnerType,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';

const LIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.DISPUTED,
];

const APPOINTMENT_LIST_INCLUDE = {
  client: { include: { user: { select: { firstName: true, lastName: true } } } },
  provider: {
    include: { user: { select: { firstName: true, lastName: true } } },
  },
  givenService: {
    include: {
      service: {
        include: {
          translations: { where: { locale: Locale.EN }, take: 1 },
        },
      },
    },
  },
  complaints: { select: { id: true }, take: 1 },
} satisfies Prisma.AppointmentInclude;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function scheduledDateKey(value: Date | string): string {
  return value instanceof Date ? toYmd(value) : String(value).slice(0, 10);
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

function pickServiceName(
  appointment: Prisma.AppointmentGetPayload<{
    include: typeof APPOINTMENT_LIST_INCLUDE;
  }>,
): string {
  return (
    appointment.givenService?.service?.translations?.[0]?.name?.trim() ||
    'Service'
  );
}

function estimateRevenue(
  price: number,
  pricingType: string | undefined,
  durationMinutes: number | null,
): number {
  if (pricingType === 'HOURLY' && durationMinutes && durationMinutes > 0) {
    return price * (durationMinutes / 60);
  }
  return price;
}

@Injectable()
export class CompanyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(companyAdminUserId: string) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const todayKey = toYmd(todayStart);
    const yesterdayKey = toYmd(
      startOfDay(new Date(now.getTime() - 86_400_000)),
    );
    const weekStart = startOfDay(new Date(now.getTime() - 6 * 86_400_000));

    // Single transaction = one DB connection (avoids pool exhaustion on Supabase session mode).
    return this.prisma.$transaction(async (tx) => {
      const admin = await tx.companyAdmin.findUnique({
        where: { id: companyAdminUserId },
        select: { companyId: true },
      });
      if (!admin?.companyId) {
        throw new NotFoundException('Company admin account not found.');
      }
      const companyId = admin.companyId;

      const complaintScope: Prisma.ComplaintWhereInput = {
        companyId,
        forwardTarget: {
          in: [ComplaintForwardTarget.COMPANY, ComplaintForwardTarget.BOTH],
        },
      };

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: {
          companyName: true,
          logo: true,
          averageRating: true,
          totalReviews: true,
          cancellationRate: true,
          averageResponseTime: true,
        },
      });

      const employeeCount = await tx.provider.count({
        where: { companyId, type: ProviderType.EMPLOYEE },
      });

      const activeServiceRows = await tx.givenService.findMany({
        where: {
          ownerType: OwnerType.COMPANY,
          ownerId: companyId,
          active: true,
        },
        distinct: ['serviceId'],
        select: { serviceId: true },
      });

      const weekRows = await tx.appointment.findMany({
        where: {
          companyId,
          scheduledDate: { gte: weekStart, lte: todayEnd },
        },
        select: {
          scheduledDate: true,
          status: true,
          durationMinutes: true,
          givenService: { select: { price: true, pricingType: true } },
        },
      });

      const pendingAssignment = await tx.appointment.count({
        where: {
          companyId,
          providerId: null,
          status: AppointmentStatus.PENDING,
        },
      });

      const disputedCount = await tx.appointment.count({
        where: { companyId, status: AppointmentStatus.DISPUTED },
      });

      const complaintGrouped = await tx.complaint.groupBy({
        by: ['status'],
        where: complaintScope,
        _count: { _all: true },
      });

      const pendingInvites = await tx.employeeInvitation.count({
        where: { companyId, status: InvitationStatus.PENDING },
      });

      const liveRows = await tx.appointment.findMany({
        where: {
          companyId,
          status: { in: LIVE_STATUSES },
        },
        include: APPOINTMENT_LIST_INCLUDE,
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
        take: 8,
      });

      const topEmployees = await tx.provider.findMany({
        where: { companyId, type: ProviderType.EMPLOYEE },
        include: {
          user: { select: { firstName: true, lastName: true } },
          _count: {
            select: {
              appointments: {
                where: { status: AppointmentStatus.COMPLETED },
              },
            },
          },
        },
        orderBy: [{ averageRating: 'desc' }, { totalReviews: 'desc' }],
        take: 5,
      });

      const auditRows = await tx.companyAuditLog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          actorAdmin: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      let todaysOrders = 0;
      let yesterdaysOrders = 0;
      const todayByStatus: Record<string, number> = {};

      for (const row of weekRows) {
        const key = scheduledDateKey(row.scheduledDate);
        if (key === todayKey) {
          todaysOrders += 1;
          todayByStatus[row.status] = (todayByStatus[row.status] ?? 0) + 1;
        } else if (key === yesterdayKey) {
          yesterdaysOrders += 1;
        }
      }

      const todayCompleted = todayByStatus[AppointmentStatus.COMPLETED] ?? 0;
      const todayPending =
        (todayByStatus[AppointmentStatus.PENDING] ?? 0) +
        (todayByStatus[AppointmentStatus.RESCHEDULED] ?? 0);
      const inProgress =
        (todayByStatus[AppointmentStatus.IN_PROGRESS] ?? 0) +
        (todayByStatus[AppointmentStatus.EN_ROUTE] ?? 0);

      const ordersTrendPct =
        yesterdaysOrders === 0
          ? todaysOrders > 0
            ? 100
            : null
          : Math.round(
              ((todaysOrders - yesterdaysOrders) / yesterdaysOrders) * 100,
            );

      const ordersTrend: { date: string; label: string; orders: number }[] = [];
      const revenueTrend: { date: string; label: string; amount: number }[] = [];

      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = toYmd(d);
        const label = i === 0 ? 'Today' : dayLabel(d);

        const dayRows = weekRows.filter(
          (a) => scheduledDateKey(a.scheduledDate) === key,
        );
        ordersTrend.push({ date: key, label, orders: dayRows.length });

        const amount = dayRows
          .filter((a) => a.status === AppointmentStatus.COMPLETED)
          .reduce((sum, a) => {
            const price = Number(a.givenService?.price ?? 0);
            return (
              sum +
              estimateRevenue(
                price,
                a.givenService?.pricingType,
                a.durationMinutes,
              )
            );
          }, 0);
        revenueTrend.push({ date: key, label, amount: Math.round(amount) });
      }

      const todayRevenue = revenueTrend[revenueTrend.length - 1]?.amount ?? 0;

      let complaintOpen = 0;
      let complaintUnderReview = 0;
      for (const row of complaintGrouped) {
        if (row.status === ComplaintStatus.OPEN) {
          complaintOpen = row._count._all;
        } else if (row.status === ComplaintStatus.UNDER_REVIEW) {
          complaintUnderReview = row._count._all;
        }
      }

      const liveOrders = liveRows.map((row) => {
        const clientName = row.client?.user
          ? `${row.client.user.firstName ?? ''} ${row.client.user.lastName ?? ''}`.trim()
          : 'Client';
        const providerName = row.provider?.user
          ? `${row.provider.user.firstName ?? ''} ${row.provider.user.lastName ?? ''}`.trim()
          : null;
        return {
          id: row.id,
          shortId: row.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
          status: row.status,
          scheduledDate: scheduledDateKey(row.scheduledDate),
          scheduledTime: row.scheduledTime,
          serviceName: pickServiceName(row),
          clientName: clientName || 'Client',
          providerId: row.providerId,
          providerName,
          providerPhotoUrl: row.provider?.photoUrl ?? null,
          needsAssignment:
            !row.providerId && row.status === AppointmentStatus.PENDING,
          hasComplaint: (row.complaints?.length ?? 0) > 0,
        };
      });

      const topProviders = topEmployees.map((p, index) => ({
        id: p.id,
        displayName:
          `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim() ||
          'Provider',
        photoUrl: p.photoUrl,
        averageRating: Number(p.averageRating ?? 0),
        totalReviews: p.totalReviews,
        completedJobs: p._count.appointments,
        isTopProvider: p.isTopProvider,
        rank: index + 1,
      }));

      const activity = auditRows.map((log) => ({
        id: log.id,
        action: log.action,
        summary: log.summary,
        actorName:
          log.actorAdmin?.user != null
            ? `${log.actorAdmin.user.firstName ?? ''} ${log.actorAdmin.user.lastName ?? ''}`.trim() ||
              'Admin'
            : 'System',
        createdAt: log.createdAt.toISOString(),
      }));

      const alerts: Array<{
        id: string;
        tone: 'urgent' | 'info' | 'neutral';
        title: string;
        message: string;
        path: string;
      }> = [];

      if (pendingAssignment > 0) {
        alerts.push({
          id: 'assign',
          tone: 'urgent',
          title: 'Orders need a provider',
          message: `${pendingAssignment} booking${pendingAssignment === 1 ? '' : 's'} waiting for assignment.`,
          path: '/company/orders',
        });
      }
      if (complaintOpen + complaintUnderReview > 0) {
        alerts.push({
          id: 'complaints',
          tone: 'urgent',
          title: 'Open complaints',
          message: `${complaintOpen + complaintUnderReview} complaint${complaintOpen + complaintUnderReview === 1 ? '' : 's'} need attention.`,
          path: '/company/complaints',
        });
      }
      if (disputedCount > 0) {
        alerts.push({
          id: 'disputes',
          tone: 'info',
          title: 'Active disputes',
          message: `${disputedCount} appointment${disputedCount === 1 ? '' : 's'} in disputed status.`,
          path: '/company/orders',
        });
      }
      if (pendingInvites > 0) {
        alerts.push({
          id: 'invites',
          tone: 'info',
          title: 'Pending invitations',
          message: `${pendingInvites} provider invitation${pendingInvites === 1 ? '' : 's'} awaiting response.`,
          path: '/company/providers',
        });
      }

      return {
        company: {
          companyName: company?.companyName ?? '',
          logo: company?.logo ?? null,
          averageRating: Number(company?.averageRating ?? 0),
          totalReviews: company?.totalReviews ?? 0,
          cancellationRate: Number(company?.cancellationRate ?? 0),
          averageResponseTime:
            company?.averageResponseTime != null
              ? Number(company.averageResponseTime)
              : null,
        },
        orders: {
          today: todaysOrders,
          yesterday: yesterdaysOrders,
          trendPct: ordersTrendPct,
          todayCompleted,
          todayPending,
          inProgress,
          pendingAssignment,
          disputed: disputedCount,
          activeLive: liveOrders.length,
        },
        team: {
          employeeCount,
          activeServices: activeServiceRows.length,
        },
        ratings: {
          averageRating: Number(company?.averageRating ?? 0),
          totalReviews: company?.totalReviews ?? 0,
        },
        complaints: {
          open: complaintOpen,
          underReview: complaintUnderReview,
          total: complaintOpen + complaintUnderReview,
        },
        ordersTrend,
        revenueTrend,
        todayRevenue,
        liveOrders,
        topProviders,
        activity,
        alerts,
        generatedAt: now.toISOString(),
      };
    });
  }
}
