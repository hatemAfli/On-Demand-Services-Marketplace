import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Locale,
  Prisma,
  ProviderType,
  ReviewVisibility,
} from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { recomputeCompanyRating } from '../../reviews/helpers/recompute-company-rating';
import { ListCompanyReviewsDto } from './dto/list-company-reviews.dto';

const REVIEW_INCLUDE = {
  client: {
    select: {
      imageUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  provider: {
    select: {
      id: true,
      photoUrl: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  givenService: {
    include: {
      service: {
        include: {
          translations: { where: { locale: Locale.EN } },
          category: { include: { translations: { where: { locale: Locale.EN } } } },
        },
      },
    },
  },
  appointment: {
    select: { id: true, scheduledDate: true, scheduledTime: true },
  },
} satisfies Prisma.ReviewInclude;

@Injectable()
export class CompanyReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async employeeIds(companyId: string): Promise<string[]> {
    const rows = await this.prisma.provider.findMany({
      where: { companyId, type: ProviderType.EMPLOYEE },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private reviewScope(providerIds: string[]): Prisma.ReviewWhereInput {
    return {
      visibility: ReviewVisibility.PUBLIC,
      providerId: { in: providerIds.length > 0 ? providerIds : ['00000000-0000-0000-0000-000000000000'] },
    };
  }

  /** Keep Company.averageRating in sync when admin opens dashboard. */
  private async syncCompanyRating(companyId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await recomputeCompanyRating(tx, companyId);
    });
  }

  async getStats(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    await this.syncCompanyRating(companyId);

    const providerIds = await this.employeeIds(companyId);
    const where = this.reviewScope(providerIds);

    const [company, employeeCount, reviews, withReply, lowRatingCount] =
      await Promise.all([
        this.prisma.company.findUnique({
          where: { id: companyId },
          select: { averageRating: true, totalReviews: true, companyName: true },
        }),
        this.prisma.provider.count({
          where: { companyId, type: ProviderType.EMPLOYEE },
        }),
        this.prisma.review.findMany({
          where,
          select: { rating: true, createdAt: true, providerReply: true },
        }),
        this.prisma.review.count({
          where: { ...where, providerReply: { not: null } },
        }),
        this.prisma.review.count({
          where: { ...where, rating: { lte: 2 } },
        }),
      ]);

    const total = reviews.length;
    const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      byRating[r.rating] = (byRating[r.rating] ?? 0) + 1;
    }

    const avgReviewRating =
      total === 0
        ? 0
        : reviews.reduce((s, r) => s + r.rating, 0) / total;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recent = reviews.filter((r) => r.createdAt >= thirtyDaysAgo);
    const prior = reviews.filter(
      (r) => r.createdAt >= sixtyDaysAgo && r.createdAt < thirtyDaysAgo,
    );
    const recentAvg =
      recent.length === 0
        ? 0
        : recent.reduce((s, r) => s + r.rating, 0) / recent.length;
    const priorAvg =
      prior.length === 0
        ? 0
        : prior.reduce((s, r) => s + r.rating, 0) / prior.length;
    const monthlyChange =
      prior.length === 0 ? 0 : Number((recentAvg - priorAvg).toFixed(2));

    return {
      companyName: company?.companyName ?? '',
      companyAverageRating: Number(company?.averageRating ?? 0),
      employeeCount,
      totalReviews: company?.totalReviews ?? total,
      reviewCount: total,
      averageReviewRating: Number(avgReviewRating.toFixed(2)),
      responseRate: total === 0 ? 0 : Math.round((withReply / total) * 100),
      withReply,
      lowRatingCount,
      byRating,
      monthlyChange,
    };
  }

  async getBreakdown(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const providerIds = await this.employeeIds(companyId);
    const where = this.reviewScope(providerIds);

    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { _all: true },
    });

    const total = grouped.reduce((s, g) => s + g._count._all, 0);
    return [5, 4, 3, 2, 1].map((star) => {
      const row = grouped.find((g) => g.rating === star);
      const count = row?._count._all ?? 0;
      return {
        star,
        count,
        percentage: total === 0 ? 0 : Math.round((count / total) * 100),
      };
    });
  }

  async getByService(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const providerIds = await this.employeeIds(companyId);
    if (providerIds.length === 0) return [];

    const reviews = await this.prisma.review.findMany({
      where: this.reviewScope(providerIds),
      select: {
        rating: true,
        givenService: {
          select: {
            serviceId: true,
            service: {
              include: {
                translations: { where: { locale: Locale.EN } },
              },
            },
          },
        },
      },
    });

    const map = new Map<
      string,
      { serviceId: string; serviceName: string; ratings: number[] }
    >();

    for (const r of reviews) {
      const serviceId = r.givenService.serviceId;
      const serviceName =
        r.givenService.service.translations[0]?.name ?? 'Service';
      const entry = map.get(serviceId) ?? {
        serviceId,
        serviceName,
        ratings: [],
      };
      entry.ratings.push(r.rating);
      map.set(serviceId, entry);
    }

    return Array.from(map.values())
      .map((e) => ({
        serviceId: e.serviceId,
        serviceName: e.serviceName,
        reviewCount: e.ratings.length,
        averageRating: Number(
          (e.ratings.reduce((s, x) => s + x, 0) / e.ratings.length).toFixed(2),
        ),
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount);
  }

  async getTrends(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const providerIds = await this.employeeIds(companyId);
    const where = this.reviewScope(providerIds);

    const since = new Date();
    since.setDate(since.getDate() - 56);

    const reviews = await this.prisma.review.findMany({
      where: { ...where, createdAt: { gte: since } },
      select: { rating: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, number[]>();
    for (const r of reviews) {
      const d = new Date(r.createdAt);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const arr = buckets.get(key) ?? [];
      arr.push(r.rating);
      buckets.set(key, arr);
    }

    const points: { week: string; label: string; rating: number; count: number }[] = [];
    const cursor = new Date(since);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    for (let i = 0; i < 8; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      const ratings = buckets.get(key) ?? [];
      const avg =
        ratings.length === 0
          ? 0
          : ratings.reduce((s, x) => s + x, 0) / ratings.length;
      points.push({
        week: key,
        label: cursor.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        rating: Number(avg.toFixed(2)),
        count: ratings.length,
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return points.filter((p) => p.count > 0 || p.rating > 0);
  }

  async getTopProviders(companyAdminUserId: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);

    const employees = await this.prisma.provider.findMany({
      where: { companyId, type: ProviderType.EMPLOYEE },
      include: {
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { appointments: true } },
      },
    });

    return employees
      .map((p) => ({
        id: p.id,
        displayName:
          `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim() ||
          'Provider',
        photoUrl: p.photoUrl,
        averageRating: Number(p.averageRating ?? 0),
        totalReviews: p.totalReviews,
        completedJobs: p._count.appointments,
        isTopProvider: p.isTopProvider,
      }))
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.totalReviews - a.totalReviews;
      })
      .slice(0, 10);
  }

  async list(companyAdminUserId: string, dto: ListCompanyReviewsDto) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const providerIds = await this.employeeIds(companyId);
    const take = dto.take ?? 10;
    const skip = dto.skip ?? 0;

    const ratingFilter: Prisma.IntFilter | undefined =
      dto.minRating != null || dto.maxRating != null
        ? {
            ...(dto.minRating != null ? { gte: dto.minRating } : {}),
            ...(dto.maxRating != null ? { lte: dto.maxRating } : {}),
          }
        : undefined;

    const where: Prisma.ReviewWhereInput = {
      ...this.reviewScope(providerIds),
      ...(dto.providerId ? { providerId: dto.providerId } : {}),
      ...(ratingFilter ? { rating: ratingFilter } : {}),
      ...(dto.hasReply === true
        ? { providerReply: { not: null } }
        : dto.hasReply === false
          ? { providerReply: null }
          : {}),
      ...(dto.serviceId
        ? { givenService: { serviceId: dto.serviceId } }
        : {}),
    };

    const orderBy = this.buildOrderBy(dto.sort ?? 'recent');

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy,
        skip,
        take,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getById(companyAdminUserId: string, id: string) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const providerIds = await this.employeeIds(companyId);

    const review = await this.prisma.review.findFirst({
      where: {
        id,
        providerId: { in: providerIds },
        visibility: ReviewVisibility.PUBLIC,
      },
      include: REVIEW_INCLUDE,
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  private buildOrderBy(
    sort: string,
  ): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case 'oldest':
        return { createdAt: 'asc' };
      case 'highest':
        return { rating: 'desc' };
      case 'lowest':
        return { rating: 'asc' };
      default:
        return { createdAt: 'desc' };
    }
  }
}
