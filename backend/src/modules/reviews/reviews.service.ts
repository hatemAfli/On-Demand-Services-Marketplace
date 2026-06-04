import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  Locale,
  NotificationType,
  Prisma,
  Review,
  ReviewVisibility,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { GetProviderReviewsDto } from './dto/get-provider-reviews.dto';
import { ReplyToReviewDto } from './dto/reply-to-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import {
  CLIENT_REVIEW_LIST_INCLUDE,
  mapClientReviewItem,
} from './helpers/client-review.mapper';
import { recomputeReviewAggregates } from './helpers/recompute-review-aggregates';

const REVIEW_LIST_INCLUDE = {
  client: {
    select: {
      imageUrl: true,
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  },
  givenService: {
    include: {
      service: {
        include: {
          translations: {
            where: { locale: Locale.EN },
          },
        },
      },
    },
  },
} satisfies Prisma.ReviewInclude;

export type ProviderReviewListItem = Prisma.ReviewGetPayload<{
  include: typeof REVIEW_LIST_INCLUDE;
}>;

const DEFAULT_TAKE = 10;
const DEFAULT_SKIP = 0;
const DEFAULT_SORT = 'recent';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createReview(
    clientUserId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        client: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        provider: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        givenService: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.client.user.id !== clientUserId) {
      throw new ForbiddenException('You can only review your own appointments');
    }

    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException(
        'You can only leave a review after the appointment is completed',
      );
    }

    if (!appointment.providerId || !appointment.provider) {
      throw new BadRequestException('Appointment has no assigned provider to review');
    }
    const reviewedProviderId = appointment.providerId;
    const reviewedProviderUserId = appointment.provider.user.id;

    const existing = await this.prisma.review.findUnique({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing) {
      throw new ConflictException('A review already exists for this appointment');
    }

    const createdReview = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          appointmentId: dto.appointmentId,
          clientId: appointment.clientId,
          providerId: reviewedProviderId,
          givenServiceId: appointment.givenServiceId,
          rating: dto.rating,
          comment: dto.comment?.trim() ? dto.comment.trim() : null,
        },
      });

      await recomputeReviewAggregates(
        tx,
        reviewedProviderId,
        appointment.givenServiceId,
      );

      return review;
    });

    const clientName = `${appointment.client.user.firstName} ${appointment.client.user.lastName}`.trim();
    const stars = '⭐'.repeat(dto.rating);
    const commentSnippet =
      dto.comment && dto.comment.trim().length > 0
        ? `: "${dto.comment.trim().slice(0, 60)}${dto.comment.trim().length > 60 ? '...' : ''}"`
        : '';

    void this.notificationsService.send({
      userId: reviewedProviderUserId,
      type: NotificationType.NEW_REVIEW,
      title: 'New review received',
      body: `${clientName} rated you ${stars}${commentSnippet}`,
      data: {
        reviewId: createdReview.id,
        screen: 'ProviderReviews',
      },
    });

    return createdReview;
  }

  async replyToReview(
    providerUserId: string,
    reviewId: string,
    dto: ReplyToReviewDto,
  ): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        provider: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.provider.user.id !== providerUserId) {
      throw new ForbiddenException('You can only reply to reviews on your own profile');
    }

    if (review.providerReply != null && review.providerReply.trim().length > 0) {
      throw new ConflictException('You have already replied to this review');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        providerReply: dto.providerReply.trim(),
        repliedAt: new Date(),
      },
    });
  }

  async getProviderReviews(
    dto: GetProviderReviewsDto,
  ): Promise<{
    items: ProviderReviewListItem[];
    total: number;
    averageRating: number;
  }> {
    if (!dto.providerId) {
      throw new BadRequestException('providerId is required');
    }

    const take = dto.take ?? DEFAULT_TAKE;
    const skip = dto.skip ?? DEFAULT_SKIP;
    const sort = dto.sort ?? DEFAULT_SORT;

    const where: Prisma.ReviewWhereInput = {
      providerId: dto.providerId,
      visibility: ReviewVisibility.PUBLIC,
      ...(dto.givenServiceId ? { givenServiceId: dto.givenServiceId } : {}),
      ...(dto.minRating != null ? { rating: { gte: dto.minRating } } : {}),
    };

    let orderBy: Prisma.ReviewOrderByWithRelationInput;
    if (sort === 'highest') {
      orderBy = { rating: 'desc' };
    } else if (sort === 'lowest') {
      orderBy = { rating: 'asc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [items, agg] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy,
        take,
        skip,
        include: REVIEW_LIST_INCLUDE,
      }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const total = agg._count._all;
    const averageRating =
      agg._avg.rating != null ? Math.round(agg._avg.rating * 100) / 100 : 0;

    return { items, total, averageRating };
  }

  async getRatingsBreakdown(
    providerId: string,
  ): Promise<{ star: number; count: number; percentage: number }[]> {
    const counts = await Promise.all(
      [5, 4, 3, 2, 1].map((star) =>
        this.prisma.review.count({
          where: {
            providerId,
            visibility: ReviewVisibility.PUBLIC,
            rating: star,
          },
        }),
      ),
    );

    const total = counts.reduce((a, b) => a + b, 0);

    return [5, 4, 3, 2, 1].map((star, i) => {
      const count = counts[i]!;
      const percentage =
        total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
      return { star, count, percentage };
    });
  }

  async checkCanReview(
    clientUserId: string,
    appointmentId: string,
  ): Promise<{
    canReview: boolean;
    alreadyReviewed: boolean;
    existingRating: number | null;
    existingComment: string | null;
  }> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!appointment) {
      return {
        canReview: false,
        alreadyReviewed: false,
        existingRating: null,
        existingComment: null,
      };
    }

    const isOwner = appointment.client.user.id === clientUserId;
    const isCompleted = appointment.status === AppointmentStatus.COMPLETED;

    const existing = await this.prisma.review.findUnique({
      where: { appointmentId },
      select: { rating: true, comment: true },
    });

    return {
      canReview: isOwner && isCompleted && !existing,
      alreadyReviewed: !!existing,
      existingRating: existing?.rating ?? null,
      existingComment: existing?.comment?.trim() || null,
    };
  }

  /** Reviews the client has submitted (settings profile stats). */
  async countByClient(clientUserId: string): Promise<{ count: number }> {
    const count = await this.prisma.review.count({
      where: { clientId: clientUserId },
    });
    return { count };
  }

  async listMyReviews(clientUserId: string, locale: 'en' | 'ar' = 'en') {
    const rows = await this.prisma.review.findMany({
      where: { clientId: clientUserId },
      orderBy: { createdAt: 'desc' },
      include: CLIENT_REVIEW_LIST_INCLUDE,
    });
    return {
      items: rows.map((row) => mapClientReviewItem(row, locale)),
      total: rows.length,
    };
  }

  async getMyReview(
    clientUserId: string,
    reviewId: string,
    locale: 'en' | 'ar' = 'en',
  ) {
    const row = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: CLIENT_REVIEW_LIST_INCLUDE,
    });
    if (!row) throw new NotFoundException('Review not found');
    if (row.clientId !== clientUserId) {
      throw new ForbiddenException('You can only access your own reviews');
    }
    return mapClientReviewItem(row, locale);
  }

  private async assertClientOwnsReview(clientUserId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        clientId: true,
        providerId: true,
        givenServiceId: true,
        hiddenAt: true,
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.clientId !== clientUserId) {
      throw new ForbiddenException('You can only modify your own reviews');
    }
    if (review.hiddenAt) {
      throw new BadRequestException('This review can no longer be edited');
    }
    return review;
  }

  async updateMyReview(
    clientUserId: string,
    reviewId: string,
    dto: UpdateReviewDto,
    locale: 'en' | 'ar' = 'en',
  ) {
    const existing = await this.assertClientOwnsReview(clientUserId, reviewId);

    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: reviewId },
        data: {
          rating: dto.rating,
          comment: dto.comment?.trim() ? dto.comment.trim() : null,
        },
      });
      await recomputeReviewAggregates(
        tx,
        existing.providerId,
        existing.givenServiceId,
      );
    });

    return this.getMyReview(clientUserId, reviewId, locale);
  }

  async deleteMyReview(clientUserId: string, reviewId: string) {
    const existing = await this.assertClientOwnsReview(clientUserId, reviewId);

    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id: reviewId } });
      await recomputeReviewAggregates(
        tx,
        existing.providerId,
        existing.givenServiceId,
      );
    });

    return { deleted: true };
  }
}
