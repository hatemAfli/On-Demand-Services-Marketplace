import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FavoriteType, Locale, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { localeFallbackChain } from '../../common/i18n/locale';
import { CreateClientFavoriteDto } from './dto/create-client-favorite.dto';

type ClientFavoriteResponse = {
  id: string;
  type: FavoriteType;
  targetId: string;
  createdAt: Date;
  updatedAt: Date;
};

type FavoriteListItem = {
  id: string;
  type: FavoriteType;
  targetId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  givenServiceId?: string;
  createdAt: Date;
};

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async listFavorites(userId: string, type?: FavoriteType, locale: Locale = 'EN') {
    await this.assertClientAccount(userId);
    const requestedLocales = localeFallbackChain(locale);

    const rows = await this.prisma.clientFavorite.findMany({
      where: {
        clientId: userId,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = (
      await Promise.all(
        rows.map(async (row): Promise<FavoriteListItem | null> => {
          const targetId = row.categoryId ?? row.serviceId ?? row.providerId;
          if (!targetId) return null;

          if (row.type === FavoriteType.CATEGORY && row.categoryId) {
            const category = await this.prisma.serviceCategory.findUnique({
              where: { id: row.categoryId },
              select: {
                slug: true,
                iconUrl: true,
                translations: { select: { locale: true, name: true } },
              },
            });
            if (!category) return null;
            const tr = requestedLocales
              .map((l) => category.translations.find((t) => t.locale === l))
              .find(Boolean);
            return {
              id: row.id,
              type: row.type,
              targetId,
              title: tr?.name ?? category.slug,
              subtitle: 'Category',
              imageUrl: category.iconUrl ?? null,
              createdAt: row.createdAt,
            };
          }

          if (row.type === FavoriteType.SERVICE && row.serviceId) {
            const service = await this.prisma.service.findUnique({
              where: { id: row.serviceId },
              select: {
                servicePhoto: true,
                translations: { select: { locale: true, name: true } },
                category: {
                  select: {
                    slug: true,
                    translations: { select: { locale: true, name: true } },
                  },
                },
              },
            });
            if (!service) return null;
            const serviceTr = requestedLocales
              .map((l) => service.translations.find((t) => t.locale === l))
              .find(Boolean);
            const categoryTr = requestedLocales
              .map((l) => service.category.translations.find((t) => t.locale === l))
              .find(Boolean);
            return {
              id: row.id,
              type: row.type,
              targetId,
              title: serviceTr?.name ?? 'Service',
              subtitle: categoryTr?.name ?? service.category.slug,
              imageUrl: service.servicePhoto ?? null,
              createdAt: row.createdAt,
            };
          }

          if (row.type === FavoriteType.PROVIDER && row.providerId) {
            const provider = await this.prisma.provider.findUnique({
              where: { id: row.providerId },
              select: {
                city: true,
                photoUrl: true,
                user: { select: { firstName: true, lastName: true } },
              },
            });
            if (!provider) return null;
            const latestGiven = await this.prisma.givenService.findFirst({
              where: { ownerType: 'PROVIDER', ownerId: row.providerId, active: true },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
            const name =
              `${provider.user.firstName ?? ''} ${provider.user.lastName ?? ''}`.trim() ||
              'Provider';
            return {
              id: row.id,
              type: row.type,
              targetId,
              title: name,
              subtitle: provider.city ?? null,
              imageUrl: provider.photoUrl ?? null,
              givenServiceId: latestGiven?.id,
              createdAt: row.createdAt,
            };
          }

          return null;
        }),
      )
    ).filter((v): v is FavoriteListItem => v !== null);

    return { items };
  }

  async createFavorite(
    userId: string,
    dto: CreateClientFavoriteDto,
  ): Promise<ClientFavoriteResponse> {
    await this.assertClientAccount(userId);

    switch (dto.type) {
      case FavoriteType.CATEGORY: {
        await this.assertCategoryExists(dto.targetId);
        const row = await this.prisma.clientFavorite.upsert({
          where: {
            clientId_categoryId: {
              clientId: userId,
              categoryId: dto.targetId,
            },
          },
          update: {},
          create: {
            clientId: userId,
            type: FavoriteType.CATEGORY,
            categoryId: dto.targetId,
          },
        });
        return this.toResponse(row);
      }

      case FavoriteType.SERVICE: {
        await this.assertServiceExists(dto.targetId);
        const row = await this.prisma.clientFavorite.upsert({
          where: {
            clientId_serviceId: {
              clientId: userId,
              serviceId: dto.targetId,
            },
          },
          update: {},
          create: {
            clientId: userId,
            type: FavoriteType.SERVICE,
            serviceId: dto.targetId,
          },
        });
        return this.toResponse(row);
      }

      case FavoriteType.PROVIDER: {
        await this.assertProviderExists(dto.targetId);
        const row = await this.prisma.clientFavorite.upsert({
          where: {
            clientId_providerId: {
              clientId: userId,
              providerId: dto.targetId,
            },
          },
          update: {},
          create: {
            clientId: userId,
            type: FavoriteType.PROVIDER,
            providerId: dto.targetId,
          },
        });
        return this.toResponse(row);
      }

      default:
        throw new BadRequestException('Unsupported favorite type');
    }
  }

  async deleteFavorite(
    userId: string,
    type: FavoriteType,
    targetId: string,
  ): Promise<{ deleted: boolean }> {
    await this.assertClientAccount(userId);

    const whereByType =
      type === FavoriteType.CATEGORY
        ? { clientId: userId, categoryId: targetId }
        : type === FavoriteType.SERVICE
          ? { clientId: userId, serviceId: targetId }
          : { clientId: userId, providerId: targetId };

    const result = await this.prisma.clientFavorite.deleteMany({
      where: whereByType,
    });

    if (result.count === 0) {
      throw new NotFoundException('Favorite not found');
    }

    return { deleted: true };
  }

  async clearFavorites(userId: string, type?: FavoriteType) {
    await this.assertClientAccount(userId);
    const result = await this.prisma.clientFavorite.deleteMany({
      where: {
        clientId: userId,
        ...(type ? { type } : {}),
      },
    });
    return { deletedCount: result.count };
  }

  private toResponse(row: {
    id: string;
    type: FavoriteType;
    categoryId: string | null;
    serviceId: string | null;
    providerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ClientFavoriteResponse {
    const targetId = row.categoryId ?? row.serviceId ?? row.providerId;
    if (!targetId) {
      throw new BadRequestException('Favorite target is missing');
    }

    return {
      id: row.id,
      type: row.type,
      targetId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async assertClientAccount(userId: string): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        client: { select: { id: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('User not found');
    }
    if (row.role !== UserRole.CLIENT) {
      throw new BadRequestException('Not a client account');
    }
    if (!row.client) {
      throw new NotFoundException('Client profile not found');
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const row = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Category not found');
  }

  private async assertServiceExists(serviceId: string): Promise<void> {
    const row = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Service not found');
  }

  private async assertProviderExists(providerId: string): Promise<void> {
    const row = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Provider not found');
  }
}
