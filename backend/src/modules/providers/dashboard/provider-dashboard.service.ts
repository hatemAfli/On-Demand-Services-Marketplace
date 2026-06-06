import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  InvitationStatus,
  Locale,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';

const JOB_EXCLUDED: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED_CLIENT,
  AppointmentStatus.CANCELLED_PROVIDER,
  AppointmentStatus.REFUSED,
];

const UPCOMING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
];

const ACCEPTED_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
  AppointmentStatus.EN_ROUTE,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
]);

const DECISION_STATUSES = new Set<AppointmentStatus>([
  ...ACCEPTED_STATUSES,
  AppointmentStatus.REFUSED,
  AppointmentStatus.CANCELLED_PROVIDER,
]);

const CALENDAR_INCLUDE = {
  givenService: {
    include: {
      service: {
        include: {
          translations: { where: { locale: Locale.EN }, take: 1 },
          category: {
            include: {
              translations: { where: { locale: Locale.EN }, take: 1 },
            },
          },
        },
      },
    },
  },
  client: {
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.AppointmentInclude;

type CalendarRow = Prisma.AppointmentGetPayload<{
  include: typeof CALENDAR_INCLUDE;
}>;

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

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function performanceBadgeKey(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'great';
  if (score >= 60) return 'good';
  return 'needsAttention';
}

function pickServiceName(row: CalendarRow): string {
  return (
    row.givenService?.service?.translations?.[0]?.name?.trim() || 'Service'
  );
}

function pickCategoryName(row: CalendarRow): string {
  return (
    row.givenService?.service?.category?.translations?.[0]?.name?.trim() ||
    'Category'
  );
}

function slotStartMs(scheduledDate: Date, scheduledTime: string): number {
  const ymd = scheduledDateKey(scheduledDate);
  const [y, mo, d] = ymd.split('-').map(Number);
  const parts = scheduledTime.split(':');
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return new Date(y, (mo || 1) - 1, d || 1, hh, mm, 0, 0).getTime();
}

function countsForJob(
  row: { scheduledDate: Date | string; status: AppointmentStatus },
  hidePending: boolean,
): boolean {
  if (JOB_EXCLUDED.includes(row.status)) return false;
  if (hidePending && row.status === AppointmentStatus.PENDING) return false;
  return true;
}

function mapUpcoming(row: CalendarRow) {
  const user = row.client?.user;
  return {
    id: row.id,
    status: row.status,
    scheduledDate: scheduledDateKey(row.scheduledDate),
    scheduledTime: row.scheduledTime,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    startedAt: row.startedAt?.toISOString() ?? null,
    enRouteAt: row.enRouteAt?.toISOString() ?? null,
    givenService: {
      serviceName: pickServiceName(row),
      categoryName: pickCategoryName(row),
    },
    client: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      imageUrl: row.client?.imageUrl ?? null,
      city: row.client?.city ?? '',
      address: row.client?.address ?? null,
    },
  };
}

@Injectable()
export class ProviderDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(providerUserId: string) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const todayKey = toYmd(todayStart);
    const yesterdayKey = toYmd(
      startOfDay(new Date(now.getTime() - 86_400_000)),
    );
    const weekStart = startOfDay(new Date(now.getTime() - 6 * 86_400_000));
    const pipelineEnd = endOfDay(new Date(now.getTime() + 6 * 86_400_000));
    const rangeEnd = endOfDay(new Date(now.getTime() + 14 * 86_400_000));

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: providerUserId },
        select: {
          firstName: true,
          lastName: true,
          provider: {
            select: {
              type: true,
              photoUrl: true,
              averageRating: true,
              totalReviews: true,
              totalComplaints: true,
              activeComplaints: true,
              company: { select: { companyName: true } },
            },
          },
        },
      });

      if (!user?.provider) {
        throw new NotFoundException('Provider profile not found.');
      }

      const provider = user.provider;
      const hidePending = provider.type === ProviderType.EMPLOYEE;
      const providerId = providerUserId;

      const rangeRows = await tx.appointment.findMany({
        where: {
          providerId,
          scheduledDate: { gte: weekStart, lte: rangeEnd },
          ...(hidePending
            ? { status: { not: AppointmentStatus.PENDING } }
            : {}),
        },
        include: CALENDAR_INCLUDE,
        orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
      });

      const perfRows = await tx.appointment.findMany({
        where: {
          providerId,
          scheduledDate: { gte: weekStart, lte: todayEnd },
        },
        select: { status: true },
      });

      let pendingInvitations = 0;
      if (provider.type === ProviderType.INDEPENDENT) {
        pendingInvitations = await tx.employeeInvitation.count({
          where: {
            providerId,
            status: InvitationStatus.PENDING,
            expiresAt: { gt: now },
          },
        });
      }

      const unreadAgg = await tx.conversation.aggregate({
        where: { providerId },
        _sum: { unreadProvider: true },
      });
      const unreadMessages = unreadAgg._sum.unreadProvider ?? 0;

      let todayJobs = 0;
      let yesterdayJobs = 0;
      let completedToday = 0;
      let weekCompleted = 0;

      const pipelineMap = new Map<AppointmentStatus, number>();

      for (const row of rangeRows) {
        const key = scheduledDateKey(row.scheduledDate);
        if (countsForJob(row, hidePending)) {
          if (key === todayKey) todayJobs += 1;
          else if (key === yesterdayKey) yesterdayJobs += 1;
        }
        if (row.status === AppointmentStatus.COMPLETED) {
          if (key === todayKey) completedToday += 1;
          if (key >= toYmd(weekStart) && key <= todayKey) weekCompleted += 1;
        }
        if (
          key >= todayKey &&
          key <= toYmd(pipelineEnd) &&
          countsForJob(row, hidePending)
        ) {
          pipelineMap.set(row.status, (pipelineMap.get(row.status) ?? 0) + 1);
        }
      }

      const jobsTrendPct =
        yesterdayJobs === 0
          ? todayJobs > 0
            ? 100
            : null
          : Math.round(((todayJobs - yesterdayJobs) / yesterdayJobs) * 100);

      let jobsTrend: 'up' | 'down' | 'same' = 'same';
      if (jobsTrendPct != null) {
        if (jobsTrendPct > 0) jobsTrend = 'up';
        else if (jobsTrendPct < 0) jobsTrend = 'down';
      }

      const activityTrend: { date: string; label: string; count: number }[] = [];
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = toYmd(d);
        const count = rangeRows.filter(
          (r) =>
            scheduledDateKey(r.scheduledDate) === key &&
            countsForJob(r, hidePending),
        ).length;
        activityTrend.push({
          date: key,
          label: i === 0 ? 'Today' : dayLabel(d),
          count,
        });
      }

      const pipelineBreakdown = [...pipelineMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      const weeklyStatuses = perfRows.map((r) => r.status);
      const decided = weeklyStatuses.filter((s) =>
        DECISION_STATUSES.has(s),
      ).length;
      const accepted = weeklyStatuses.filter((s) =>
        ACCEPTED_STATUSES.has(s),
      ).length;
      const completed = weeklyStatuses.filter(
        (s) => s === AppointmentStatus.COMPLETED,
      ).length;
      const acceptPct =
        decided > 0 ? clampPct((accepted / decided) * 100) : 0;
      const completePct =
        accepted > 0 ? clampPct((completed / accepted) * 100) : 0;

      const ratingNum = Number(provider.averageRating ?? 0);
      const performanceScore =
        ((Number.isFinite(ratingNum) ? ratingNum : 0) / 5) * 40 +
        acceptPct * 0.3 +
        completePct * 0.3;

      const nowMs = now.getTime();
      const upcoming = rangeRows
        .filter((row) => {
          if (!UPCOMING_STATUSES.includes(row.status)) return false;
          if (hidePending && row.status === AppointmentStatus.PENDING) {
            return false;
          }
          if (JOB_EXCLUDED.includes(row.status)) return false;
          return slotStartMs(row.scheduledDate, row.scheduledTime) >= nowMs;
        })
        .slice(0, 4)
        .map(mapUpcoming);

      return {
        profile: {
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          photoUrl: provider.photoUrl,
          type: provider.type,
          companyName: provider.company?.companyName ?? null,
          averageRating: Number.isFinite(ratingNum) ? ratingNum : 0,
          totalReviews: provider.totalReviews,
        },
        complaints: {
          totalComplaints: provider.totalComplaints,
          activeComplaints: provider.activeComplaints,
        },
        performance: {
          acceptPct,
          completePct,
          badgeKey: performanceBadgeKey(performanceScore),
        },
        kpi: {
          todayJobs,
          yesterdayJobs,
          completedToday,
          weekCompleted,
          remainingToday: Math.max(0, todayJobs - completedToday),
          jobsTrendPct,
          jobsTrend,
        },
        activityTrend,
        pipelineBreakdown,
        upcoming,
        pendingInvitations,
        unreadMessages,
      };
    });
  }
}
