import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Locale, OwnerType } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../config/prisma.config';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private pickName(
    translations: { locale: Locale; name: string }[],
    locale: Locale,
  ): string {
    return (
      translations.find((t) => t.locale === locale)?.name ??
      translations.find((t) => t.locale === Locale.EN)?.name ??
      translations[0]?.name ??
      ''
    );
  }

  async buildEmbeddingText(givenServiceId: string): Promise<string | null> {
    const gs = await this.prisma.givenService.findUnique({
      where: { id: givenServiceId },
      include: {
        service: {
          include: {
            translations: true,
            category: { include: { translations: true } },
          },
        },
      },
    });

    if (!gs) return null;

    const serviceNameEn = this.pickName(gs.service.translations, Locale.EN);
    const serviceNameAr = this.pickName(gs.service.translations, Locale.AR);
    const categoryNameEn = this.pickName(
      gs.service.category.translations,
      Locale.EN,
    );

    let ownerLabel = 'Provider';
    let city = '';
    let tagline = '';
    let bio = '';

    if (gs.ownerType === OwnerType.PROVIDER) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: gs.ownerId },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      });
      if (provider) {
        ownerLabel =
          `${provider.user?.firstName ?? ''} ${provider.user?.lastName ?? ''}`.trim() ||
          'Provider';
        city = provider.city ?? '';
        tagline = provider.tagline ?? '';
        bio = provider.bio ?? '';
      }
    } else if (gs.ownerType === OwnerType.COMPANY) {
      const company = await this.prisma.company.findUnique({
        where: { id: gs.ownerId },
      });
      if (company) {
        ownerLabel = company.companyName || 'Company';
        city = company.city ?? '';
        tagline = company.about?.slice(0, 120) ?? '';
        bio = company.about ?? '';
      }
    }

    const avgRating = Number(gs.averageRating ?? 0);
    const totalReviews = Number(gs.totalReviews ?? 0);
    const ownerKind =
      gs.ownerType === OwnerType.COMPANY ? 'Company' : 'Provider';

    return [
      `Service: ${serviceNameEn} / ${serviceNameAr}`,
      `Category: ${categoryNameEn}`,
      `${ownerKind}: ${ownerLabel}`,
      `City: ${city}`,
      tagline ? `Tagline: ${tagline}` : null,
      bio ? `About: ${bio}` : null,
      gs.description ? `Description: ${gs.description}` : null,
      gs.whatIsIncluded ? `What's included: ${gs.whatIsIncluded}` : null,
      `Price: ${gs.price} ${gs.pricingType}`,
      `Rating: ${avgRating} stars from ${totalReviews} reviews`,
      `Available immediately: ${gs.isAvailableImmediately ? 'yes' : 'no'}`,
      `Owner type: ${gs.ownerType}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  async syncEmbedding(givenServiceId: string): Promise<void> {
    const gs = await this.prisma.givenService.findUnique({
      where: { id: givenServiceId },
      include: {
        service: {
          include: {
            translations: true,
            category: { include: { translations: true } },
          },
        },
      },
    });

    if (!gs) {
      this.logger.warn(`GivenService ${givenServiceId} not found for embedding sync`);
      return;
    }

    const serviceName = this.pickName(gs.service.translations, Locale.EN);
    const categoryName = this.pickName(
      gs.service.category.translations,
      Locale.EN,
    );

    let city = '';
    let isTopProvider = false;
    let ownerAverageRating = 0;
    let ownerTotalReviews = 0;

    if (gs.ownerType === OwnerType.PROVIDER) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: gs.ownerId },
      });
      if (provider) {
        city = provider.city ?? '';
        isTopProvider = Boolean(provider.isTopProvider);
        ownerAverageRating = Number(provider.averageRating ?? 0);
        ownerTotalReviews = Number(provider.totalReviews ?? 0);
      }
    } else if (gs.ownerType === OwnerType.COMPANY) {
      const company = await this.prisma.company.findUnique({
        where: { id: gs.ownerId },
      });
      if (company) {
        city = company.city ?? '';
        ownerAverageRating = Number(company.averageRating ?? 0);
        ownerTotalReviews = Number(company.totalReviews ?? 0);
      }
    }

    const embeddingText = await this.buildEmbeddingText(givenServiceId);
    let embedding: number[] | null = null;

    if (gs.active && embeddingText) {
      const chatbotUrl = this.configService.get<string>('CHATBOT_URL');
      const secret = this.configService.get<string>('NESTJS_CHATBOT_SECRET');
      if (!chatbotUrl || !secret) {
        this.logger.warn('CHATBOT_URL or NESTJS_CHATBOT_SECRET not configured');
        return;
      }

      try {
        const response = await firstValueFrom(
          this.httpService.post<{ embedding: number[] }>(
            `${chatbotUrl.replace(/\/$/, '')}/embed`,
            { text: embeddingText, given_service_id: givenServiceId },
            {
              headers: { 'X-Chatbot-Secret': secret },
              timeout: 30000,
            },
          ),
        );
        embedding = response.data.embedding;
      } catch (err) {
        this.logger.error(`Embedding API failed for ${givenServiceId}`, err);
        throw err;
      }
    }

    await this.upsertEmbeddingRow({
      givenServiceId,
      ownerId: gs.ownerId,
      ownerType: gs.ownerType,
      serviceId: gs.serviceId,
      serviceName,
      categoryName,
      city,
      price: gs.price,
      pricingType: gs.pricingType,
      averageRating: Number(gs.averageRating ?? ownerAverageRating),
      totalReviews: Number(gs.totalReviews ?? ownerTotalReviews),
      isAvailableImmediately: Boolean(gs.isAvailableImmediately),
      isTopProvider,
      isActive: gs.active,
      embedding,
      embeddingText,
    });
  }

  /** Direct Postgres upsert via Prisma (avoids Supabase PostgREST permission issues). */
  private async upsertEmbeddingRow(data: {
    givenServiceId: string;
    ownerId: string;
    ownerType: string;
    serviceId: string;
    serviceName: string;
    categoryName: string;
    city: string;
    price: number;
    pricingType: string;
    averageRating: number;
    totalReviews: number;
    isAvailableImmediately: boolean;
    isTopProvider: boolean;
    isActive: boolean;
    embedding: number[] | null;
    embeddingText: string | null;
  }): Promise<void> {
    const vectorLiteral = data.embedding
      ? `[${data.embedding.join(',')}]`
      : null;

    try {
      await this.prisma.$executeRawUnsafe(
        `
        INSERT INTO provider_service_embeddings (
          given_service_id, owner_id, owner_type, service_id,
          service_name, category_name, city, price, pricing_type,
          average_rating, total_reviews, is_available_immediately,
          is_top_provider, is_active, embedding, embedding_text, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3, $4::uuid,
          $5, $6, $7, $8::double precision, $9,
          $10::double precision, $11::integer, $12,
          $13, $14, $15::vector, $16, NOW()
        )
        ON CONFLICT (given_service_id) DO UPDATE SET
          owner_id = EXCLUDED.owner_id,
          owner_type = EXCLUDED.owner_type,
          service_id = EXCLUDED.service_id,
          service_name = EXCLUDED.service_name,
          category_name = EXCLUDED.category_name,
          city = EXCLUDED.city,
          price = EXCLUDED.price,
          pricing_type = EXCLUDED.pricing_type,
          average_rating = EXCLUDED.average_rating,
          total_reviews = EXCLUDED.total_reviews,
          is_available_immediately = EXCLUDED.is_available_immediately,
          is_top_provider = EXCLUDED.is_top_provider,
          is_active = EXCLUDED.is_active,
          embedding = EXCLUDED.embedding,
          embedding_text = EXCLUDED.embedding_text,
          updated_at = NOW()
        `,
        data.givenServiceId,
        data.ownerId,
        data.ownerType,
        data.serviceId,
        data.serviceName,
        data.categoryName,
        data.city,
        data.price,
        data.pricingType,
        data.averageRating,
        data.totalReviews,
        data.isAvailableImmediately,
        data.isTopProvider,
        data.isActive,
        vectorLiteral,
        data.embeddingText,
      );
    } catch (err) {
      this.logger.error(
        `DB upsert failed for ${data.givenServiceId}`,
        err,
      );
      throw err;
    }
  }

  async syncAllEmbeddings(): Promise<{ synced: number; errors: number; lastError?: string }> {
    const rows = await this.prisma.givenService.findMany({
      where: { active: true },
      select: { id: true },
    });

    let synced = 0;
    let errors = 0;
    let lastError: string | undefined;
    const batchSize = 10;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ id }) => {
          try {
            await this.syncEmbedding(id);
            synced += 1;
          } catch (err) {
            errors += 1;
            if (!lastError) {
              lastError =
                err instanceof Error
                  ? err.message
                  : typeof err === 'object' && err !== null && 'message' in err
                    ? String((err as { message: unknown }).message)
                    : String(err);
            }
          }
        }),
      );
    }

    return { synced, errors, ...(lastError ? { lastError } : {}) };
  }

  /** Fire-and-forget wrapper for hooks after GivenService changes. */
  scheduleSync(givenServiceId: string): void {
    void this.syncEmbedding(givenServiceId).catch((err) => {
      this.logger.error(`Background embedding sync failed for ${givenServiceId}`, err);
    });
  }
}
