import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AccountStatus,
  Locale,
  Prisma,
  UserRole,
} from '@prisma/client';
import { localeFallbackChain } from '../../common/i18n/locale';
import { PrismaService } from '../../config/prisma.config';
import { SupabaseService } from '../../config/supabase.config';
import { UserAccountService } from '../accounts/user-account.service';
import { ClientHomeService } from './client-home.service';
import { AddClientSearchHistoryDto } from './dto/add-client-search-history.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private userAccount: UserAccountService,
    private supabase: SupabaseService,
    private clientHome: ClientHomeService,
  ) {}

  async updateMe(userId: string, dto: UpdateClientDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException('Not a client account');
    }
    if (!user.client) {
      throw new NotFoundException(
        'Client profile not found. Complete registration first.',
      );
    }

    const userUpdateData = this.userAccount.buildUserUpdateData(dto);
    const clientUpdateData: Prisma.ClientUpdateInput = {};

    if (dto.city !== undefined) clientUpdateData.city = dto.city;
    if (dto.address !== undefined) clientUpdateData.address = dto.address;
    if (dto.imageUrl !== undefined) clientUpdateData.imageUrl = dto.imageUrl;

    if (
      Object.keys(userUpdateData).length === 0 &&
      Object.keys(clientUpdateData).length === 0
    ) {
      throw new BadRequestException('No data to update');
    }

    return this.prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      if (Object.keys(clientUpdateData).length > 0) {
        await tx.client.update({
          where: { id: userId },
          data: clientUpdateData,
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { client: true },
      });
    });
  }

  /**
   * Soft-delete client account: DELETED + deletedAt, clear client.imageUrl,
   * remove avatar objects from storage. Requires correct Supabase password.
   */
  async softDeleteMe(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== UserRole.CLIENT) {
      throw new BadRequestException('Not a client account');
    }
    if (!user.client) {
      throw new NotFoundException(
        'Client profile not found. Complete registration first.',
      );
    }
    if (user.status === AccountStatus.DELETED) {
      throw new ConflictException('Account is already deleted');
    }

    const verify = await this.supabase.verifyPasswordForEmail(
      user.email,
      password,
    );
    if (!verify.ok) {
      throw new UnauthorizedException(verify.message || 'Invalid password');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.DELETED,
          deletedAt: now,
        },
      });
      await tx.client.update({
        where: { id: userId },
        data: { imageUrl: null },
      });
    });

    await this.supabase.removeClientAvatarFolder(userId);

    return { message: 'Account deleted', deletedAt: now.toISOString() };
  }

  async getSearchHistory(userId: string, locale: Locale) {
    await this.assertClientAccount(userId);
    const requestedLocales = localeFallbackChain(locale);
    const rows = await this.prisma.clientSearchHistory.findMany({
      where: { clientId: userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        query: true,
        createdAt: true,
        updatedAt: true,
        service: {
          select: {
            id: true,
            categoryId: true,
            active: true,
            servicePhoto: true,
            createdAt: true,
            updatedAt: true,
            translations: {
              select: {
                locale: true,
                name: true,
                description: true,
              },
            },
            category: {
              select: {
                id: true,
                slug: true,
                active: true,
                iconKey: true,
                iconUrl: true,
                translations: {
                  select: {
                    locale: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      query: row.query,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      service: this.toLocalizedService(row.service, requestedLocales),
    }));
  }

  async addSearchHistory(userId: string, dto: AddClientSearchHistoryDto, locale: Locale) {
    await this.assertClientAccount(userId);

    const serviceExists = await this.prisma.service.findFirst({
      where: {
        id: dto.serviceId,
        active: true,
        category: { active: true },
      },
      select: { id: true },
    });
    if (!serviceExists) {
      throw new NotFoundException('Service not found');
    }

    await this.prisma.clientSearchHistory.upsert({
      where: {
        clientId_serviceId: {
          clientId: userId,
          serviceId: dto.serviceId,
        },
      },
      update: {
        query: dto.query?.trim() || null,
      },
      create: {
        clientId: userId,
        serviceId: dto.serviceId,
        query: dto.query?.trim() || null,
      },
    });

    await this.clientHome.invalidatePopularNearbyCache(userId);

    return this.getSearchHistory(userId, locale);
  }

  async clearSearchHistory(userId: string) {
    await this.assertClientAccount(userId);
    const deleted = await this.prisma.clientSearchHistory.deleteMany({
      where: { clientId: userId },
    });
    await this.clientHome.invalidatePopularNearbyCache(userId);
    return { deletedCount: deleted.count };
  }

  private async assertClientAccount(userId: string) {
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

  private toLocalizedService(
    service: {
      id: string;
      categoryId: string;
      active: boolean;
      servicePhoto: string | null;
      createdAt: Date;
      updatedAt: Date;
      translations: { locale: Locale; name: string; description: string | null }[];
      category: {
        id: string;
        slug: string;
        active: boolean;
        iconKey: string | null;
        iconUrl: string | null;
        translations: { locale: Locale; name: string }[];
      };
    },
    requestedLocales: Locale[],
  ) {
    const localizedService = requestedLocales
      .map((candidate) =>
        service.translations.find((translation) => translation.locale === candidate),
      )
      .find(Boolean);
    const localizedCategory = requestedLocales
      .map((candidate) =>
        service.category.translations.find(
          (translation) => translation.locale === candidate,
        ),
      )
      .find(Boolean);

    return {
      id: service.id,
      name: localizedService?.name ?? 'Unnamed service',
      description: localizedService?.description ?? null,
      categoryId: service.categoryId,
      active: service.active,
      servicePhoto: service.servicePhoto,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      category: {
        id: service.category.id,
        name: localizedCategory?.name ?? service.category.slug,
        slug: service.category.slug,
        active: service.category.active,
        iconKey: service.category.iconKey,
        iconUrl: service.category.iconUrl,
      },
    };
  }
}
