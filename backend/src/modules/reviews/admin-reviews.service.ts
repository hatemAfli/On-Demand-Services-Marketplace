import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, PlatformAuditAction, Prisma, ReviewVisibility } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import type { PlatformAuditContext } from '../platform-audit/platform-audit.types';
import { recomputeProviderTopProviderStatus } from '../appointments/helpers/top-provider-status';
import { recomputeCompanyRating } from './helpers/recompute-company-rating';
import { GetAdminReviewsDto } from './dto/get-admin-reviews.dto';
import { HideReviewDto } from './dto/hide-review.dto';

const DEFAULT_TAKE = 20;
const DEFAULT_SKIP = 0;
const DEFAULT_SORT = 'recent';

export const ADMIN_REVIEW_INCLUDE = {
  client: {
    select: {
      id: true,
      imageUrl: true,
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  },
  provider: {
    select: {
      id: true,
      photoUrl: true,
      averageRating: true,
      totalReviews: true,
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  },
  givenService: {
    select: {
      id: true,
      service: {
        select: {
          translations: {
            select: { locale: true, name: true },
          },
        },
      },
    },
  },
  appointment: {
    select: {
      id: true,
      scheduledDate: true,
    },
  },
} satisfies Prisma.ReviewInclude;

export type AdminReviewPayload = Prisma.ReviewGetPayload<{
  include: typeof ADMIN_REVIEW_INCLUDE;
}>;

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: PlatformAuditService,
  ) {}

  async list(dto: GetAdminReviewsDto) {
    const take = dto.take ?? DEFAULT_TAKE;
    const skip = dto.skip ?? DEFAULT_SKIP;
    const sort = dto.sort ?? DEFAULT_SORT;
    const where = this.buildWhere(dto);
    const orderBy = this.buildOrderBy(sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy,
        take,
        skip,
        include: ADMIN_REVIEW_INCLUDE,
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getStats() {
    const [ratingGroups, publicAgg, hidden, withReply] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['rating'],
        _count: { _all: true },
      }),
      this.prisma.review.aggregate({
        where: { visibility: ReviewVisibility.PUBLIC },
        _avg: { rating: true },
      }),
      this.prisma.review.count({
        where: { visibility: ReviewVisibility.HIDDEN },
      }),
      this.prisma.review.count({
        where: { providerReply: { not: null } },
      }),
    ]);

    const byRating = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    } as Record<1 | 2 | 3 | 4 | 5, number>;

    let total = 0;
    for (const row of ratingGroups) {
      if (row.rating >= 1 && row.rating <= 5) {
        byRating[row.rating as 1 | 2 | 3 | 4 | 5] = row._count._all;
        total += row._count._all;
      }
    }

    return {
      total,
      averageRating:
        publicAgg._avg.rating != null
          ? Math.round(publicAgg._avg.rating * 100) / 100
          : 0,
      hidden,
      withReply,
      byRating,
    };
  }

  async getById(id: string): Promise<AdminReviewPayload> {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: ADMIN_REVIEW_INCLUDE,
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async hide(
    id: string,
    dto: HideReviewDto,
    ctx?: PlatformAuditContext,
  ): Promise<AdminReviewPayload> {
    const review = await this.findReviewOrThrow(id);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.review.update({
        where: { id },
        data: {
          visibility: ReviewVisibility.HIDDEN,
          hiddenReason: dto.reason.trim(),
          hiddenAt: now,
        },
        include: ADMIN_REVIEW_INCLUDE,
      });
      await this.recomputeRatings(tx, review.providerId, review.givenServiceId);
      return row;
    });

    void this.notificationsService.send({
      userId: review.provider.user.id,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Review hidden',
      body: 'One of your reviews has been hidden by the admin',
      data: { reviewId: id, screen: 'ProviderReviews' },
    });

    const actor = ctx
      ? await this.audit.actorName(ctx.actorAdminId)
      : 'Admin';
    this.audit.logIf(
      ctx,
      PlatformAuditAction.REVIEW_HIDDEN,
      `${actor} hid a review.`,
      { reviewId: id, reason: dto.reason.trim() },
    );

    return updated;
  }

  async restore(
    id: string,
    ctx?: PlatformAuditContext,
  ): Promise<AdminReviewPayload> {
    const review = await this.findReviewOrThrow(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.review.update({
        where: { id },
        data: {
          visibility: ReviewVisibility.PUBLIC,
          hiddenReason: null,
          hiddenAt: null,
        },
        include: ADMIN_REVIEW_INCLUDE,
      });
      await this.recomputeRatings(tx, review.providerId, review.givenServiceId);
      return row;
    });

    void this.notificationsService.send({
      userId: review.provider.user.id,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: 'Review restored',
      body: 'A previously hidden review has been restored',
      data: { reviewId: id, screen: 'ProviderReviews' },
    });

    const actor = ctx
      ? await this.audit.actorName(ctx.actorAdminId)
      : 'Admin';
    this.audit.logIf(
      ctx,
      PlatformAuditAction.REVIEW_RESTORED,
      `${actor} restored a hidden review.`,
      { reviewId: id },
    );

    return updated;
  }

  async remove(id: string, ctx?: PlatformAuditContext): Promise<void> {
    const review = await this.findReviewOrThrow(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.recomputeRatings(tx, review.providerId, review.givenServiceId);
    });

    const actor = ctx
      ? await this.audit.actorName(ctx.actorAdminId)
      : 'Admin';
    this.audit.logIf(
      ctx,
      PlatformAuditAction.REVIEW_DELETED,
      `${actor} permanently deleted a review.`,
      { reviewId: id, providerId: review.providerId },
    );
  }

  private async findReviewOrThrow(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        provider: {
          include: { user: { select: { id: true } } },
        },
      },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  private buildWhere(dto: GetAdminReviewsDto): Prisma.ReviewWhereInput {
    const ratingFilter: Prisma.IntFilter | undefined =
      dto.minRating != null || dto.maxRating != null
        ? {
            ...(dto.minRating != null ? { gte: dto.minRating } : {}),
            ...(dto.maxRating != null ? { lte: dto.maxRating } : {}),
          }
        : undefined;

    return {
      ...(dto.visibility != null ? { visibility: dto.visibility } : {}),
      ...(dto.providerId != null ? { providerId: dto.providerId } : {}),
      ...(ratingFilter != null ? { rating: ratingFilter } : {}),
    };
  }

  private buildOrderBy(sort: string): Prisma.ReviewOrderByWithRelationInput {
    switch (sort) {
      case 'oldest':
        return { createdAt: 'asc' };
      case 'highest':
        return { rating: 'desc' };
      case 'lowest':
        return { rating: 'asc' };
      case 'recent':
      default:
        return { createdAt: 'desc' };
    }
  }

  private async recomputeRatings(
    tx: Prisma.TransactionClient,
    providerId: string,
    givenServiceId: string,
  ): Promise<void> {
    const publicWhere = {
      visibility: ReviewVisibility.PUBLIC,
    } as const;

    const providerRatings = await tx.review.findMany({
      where: { providerId, ...publicWhere },
      select: { rating: true },
    });
    const providerTotal = providerRatings.length;
    const providerAvg =
      providerTotal === 0
        ? 0
        : providerRatings.reduce((s, r) => s + r.rating, 0) / providerTotal;

    await tx.provider.update({
      where: { id: providerId },
      data: {
        averageRating: new Prisma.Decimal(providerAvg.toFixed(2)),
        totalReviews: providerTotal,
      },
    });
    await recomputeProviderTopProviderStatus(tx, providerId);

    const serviceRatings = await tx.review.findMany({
      where: { givenServiceId, ...publicWhere },
      select: { rating: true },
    });
    const serviceTotal = serviceRatings.length;
    const serviceAvg =
      serviceTotal === 0
        ? 0
        : serviceRatings.reduce((s, r) => s + r.rating, 0) / serviceTotal;

    await tx.givenService.update({
      where: { id: givenServiceId },
      data: {
        averageRating: new Prisma.Decimal(serviceAvg.toFixed(2)),
        totalReviews: serviceTotal,
      },
    });

    const provider = await tx.provider.findUnique({
      where: { id: providerId },
      select: { companyId: true },
    });
    if (provider?.companyId) {
      await recomputeCompanyRating(tx, provider.companyId);
    }
  }
}
