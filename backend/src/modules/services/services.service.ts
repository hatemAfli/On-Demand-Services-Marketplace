import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { localeFallbackChain } from '../../common/i18n/locale';
import type { CreateAdminServiceDto } from './dto/create-admin-service.dto';
import type { ListServicesAdminQueryDto } from './dto/list-services-admin-query.dto';
import type { UpdateAdminServiceDto } from './dto/update-admin-service.dto';

const serviceListSelect = {
  id: true,
  categoryId: true,
  active: true,
  servicePhoto: true,
  createdAt: true,
  updatedAt: true,
  translations: {
    where: { locale: { in: [Locale.EN, Locale.AR] } },
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
        where: { locale: { in: [Locale.EN, Locale.AR] } },
        select: {
          locale: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.ServiceSelect;

const localizedServiceListSelect = {
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
} satisfies Prisma.ServiceSelect;

function pickServiceTranslation(
  translations: { locale: Locale; name: string; description: string | null }[],
  preferred: Locale[],
) {
  for (const locale of preferred) {
    const match = translations.find((translation) => translation.locale === locale);
    if (match?.name?.trim()) {
      return match;
    }
  }
  return (
    translations.find((translation) => translation.name.trim()) ?? {
      locale: Locale.EN,
      name: 'Unnamed service',
      description: null,
    }
  );
}

function pickCategoryName(
  translations: { locale: Locale; name: string }[],
  preferred: Locale[],
  fallback: string,
): string {
  for (const locale of preferred) {
    const match = translations.find((translation) => translation.locale === locale);
    if (match?.name?.trim()) {
      return match.name;
    }
  }
  return translations.find((translation) => translation.name.trim())?.name ?? fallback;
}

function toServiceTranslationMap(
  translations: { locale: Locale; name: string; description: string | null }[],
): Record<string, { name: string; description: string | null }> {
  const out: Record<string, { name: string; description: string | null }> = {};
  for (const tr of translations) {
    out[tr.locale.toLowerCase()] = {
      name: tr.name,
      description: tr.description ?? null,
    };
  }
  return out;
}

function toCategoryTranslationMap(
  translations: { locale: Locale; name: string }[],
): Record<string, { name: string }> {
  const out: Record<string, { name: string }> = {};
  for (const tr of translations) {
    out[tr.locale.toLowerCase()] = { name: tr.name };
  }
  return out;
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Convenience alias for category-scoped discovery (`GET /services/category/:id`). */
  async findByCategoryId(categoryId: string, locale?: Locale) {
    return this.findAll({ categoryId, locale });
  }

  /**
   * Active `GivenService` rows for a catalog service (marketplace supply count).
   */
  async countActiveGivenServicesForCatalog(serviceId: string) {
    const exists = await this.prisma.service.findFirst({
      where: { id: serviceId, active: true },
    });
    if (!exists) {
      throw new NotFoundException('Service not found');
    }
    const count = await this.prisma.givenService.count({
      where: { serviceId, active: true },
    });
    return { count };
  }

  async findAll(params?: {
    categoryId?: string;
    categorySlug?: string;
    locale?: Locale;
  }) {
    const locale = params?.locale ?? Locale.EN;
    const requestedLocales = localeFallbackChain(locale);
    const where: Prisma.ServiceWhereInput = {
      active: true,
      category: { active: true },
    };
    if (params?.categoryId?.trim()) {
      where.categoryId = params.categoryId.trim();
    }
    if (params?.categorySlug?.trim()) {
      where.category = {
        slug: params.categorySlug.trim(),
        active: true,
      };
    }
    const rows = await this.prisma.service.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: localizedServiceListSelect,
    });

    const serviceIds = rows.map((r) => r.id);
    const aggregates =
      serviceIds.length === 0
        ? []
        : await this.prisma.givenService.groupBy({
            by: ['serviceId'],
            where: {
              active: true,
              serviceId: { in: serviceIds },
            },
            _count: { _all: true },
          });
    const activeGivenByServiceId = new Map(
      aggregates.map((a) => [a.serviceId, a._count._all]),
    );

    return rows.map((row) => {
      const localizedService = requestedLocales
        .map((candidate) =>
          row.translations.find((translation) => translation.locale === candidate),
        )
        .find(Boolean);
      const localizedCategory = requestedLocales
        .map((candidate) =>
          row.category.translations.find(
            (translation) => translation.locale === candidate,
          ),
        )
        .find(Boolean);

      return {
        id: row.id,
        name: localizedService?.name ?? 'Unnamed service',
        description: localizedService?.description ?? null,
        categoryId: row.categoryId,
        active: row.active,
        servicePhoto: row.servicePhoto,
        activeGivenCount: activeGivenByServiceId.get(row.id) ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        category: {
          id: row.category.id,
          name:
            localizedCategory?.name ??
            pickCategoryName(row.category.translations, requestedLocales, row.category.slug),
          slug: row.category.slug,
          active: row.category.active,
          iconKey: row.category.iconKey,
          iconUrl: row.category.iconUrl,
        },
      };
    });
  }

  async adminList(query: ListServicesAdminQueryDto) {
    const where: Prisma.ServiceWhereInput = {};
    if (query.activeOnly) {
      where.active = true;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    const rows = await this.prisma.service.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: serviceListSelect,
    });

    return rows
      .map((row) => {
        const tr = pickServiceTranslation(row.translations, [Locale.EN, Locale.AR]);
        return {
          ...row,
          name: tr.name,
          description: tr.description,
          translations: toServiceTranslationMap(row.translations),
          category: {
            ...row.category,
            name: pickCategoryName(
              row.category.translations,
              [Locale.EN, Locale.AR],
              row.category.slug,
            ),
            translations: toCategoryTranslationMap(row.category.translations),
          },
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async adminFindOne(id: string) {
    const row = await this.prisma.service.findUnique({
      where: { id },
      select: serviceListSelect,
    });
    if (!row) {
      throw new NotFoundException('Service not found');
    }
    const tr = pickServiceTranslation(row.translations, [Locale.EN, Locale.AR]);
    return {
      ...row,
      name: tr.name,
      description: tr.description,
      translations: toServiceTranslationMap(row.translations),
      category: {
        ...row.category,
        name: pickCategoryName(
          row.category.translations,
          [Locale.EN, Locale.AR],
          row.category.slug,
        ),
        translations: toCategoryTranslationMap(row.category.translations),
      },
    };
  }

  async adminCreate(dto: CreateAdminServiceDto) {
    await this.ensureCategoryExists(dto.categoryId);
    const en = dto.translations?.en;
    if (!en?.name?.trim()) {
      throw new BadRequestException('English service name is required');
    }
    const ar = dto.translations?.ar;
    const created = await this.prisma.service.create({
      data: {
        categoryId: dto.categoryId,
        active: dto.active ?? true,
        servicePhoto: dto.servicePhoto?.trim() || null,
        translations: {
          create: [
            {
              locale: Locale.EN,
              name: en.name.trim(),
              description: en.description?.trim() || null,
            },
            ...(ar?.name?.trim()
              ? [
                  {
                    locale: Locale.AR,
                    name: ar.name.trim(),
                    description: ar.description?.trim() || null,
                  },
                ]
              : []),
          ],
        },
      },
      select: serviceListSelect,
    });
    return this.adminFindOne(created.id);
  }

  async adminUpdate(id: string, dto: UpdateAdminServiceDto) {
    await this.adminFindOne(id);
    const data: Prisma.ServiceUpdateInput = {};
    if (dto.categoryId !== undefined) {
      await this.ensureCategoryExists(dto.categoryId);
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (dto.servicePhoto !== undefined) {
      data.servicePhoto =
        dto.servicePhoto === null || dto.servicePhoto === ''
          ? null
          : dto.servicePhoto.trim();
    }
    const updated = await this.prisma.service.update({
      where: { id },
      data,
      select: serviceListSelect,
    });
    if (dto.name !== undefined || dto.description !== undefined) {
      await this.prisma.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: id, locale: Locale.EN } },
        update: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
        },
        create: {
          serviceId: id,
          locale: Locale.EN,
          name: dto.name?.trim() || 'Unnamed service',
          description:
            dto.description !== undefined ? dto.description.trim() || null : null,
        },
      });
    }
    const enName = dto.translations?.en?.name?.trim();
    const enDescription =
      dto.translations?.en?.description !== undefined
        ? dto.translations.en.description.trim() || null
        : undefined;
    if (dto.translations?.en !== undefined) {
      await this.prisma.serviceTranslation.upsert({
        where: { serviceId_locale: { serviceId: id, locale: Locale.EN } },
        update: {
          ...(enName !== undefined ? { name: enName } : {}),
          ...(enDescription !== undefined ? { description: enDescription } : {}),
        },
        create: {
          serviceId: id,
          locale: Locale.EN,
          name: enName || 'Unnamed service',
          description: enDescription ?? null,
        },
      });
    }
    const arName = dto.translations?.ar?.name?.trim();
    const arDescription =
      dto.translations?.ar?.description !== undefined
        ? dto.translations.ar.description.trim() || null
        : undefined;
    if (dto.translations?.ar !== undefined) {
      if (arName) {
        await this.prisma.serviceTranslation.upsert({
          where: { serviceId_locale: { serviceId: id, locale: Locale.AR } },
          update: {
            name: arName,
            ...(arDescription !== undefined ? { description: arDescription } : {}),
          },
          create: {
            serviceId: id,
            locale: Locale.AR,
            name: arName,
            description: arDescription ?? null,
          },
        });
      } else {
        await this.prisma.serviceTranslation.deleteMany({
          where: { serviceId: id, locale: Locale.AR },
        });
      }
    }
    return this.adminFindOne(updated.id);
  }

  async adminRemove(id: string) {
    await this.adminFindOne(id);
    const verificationCount = await this.prisma.verificationProfilRequest.count({
      where: { serviceId: id },
    });
    if (verificationCount > 0) {
      throw new ConflictException(
        'Cannot delete this catalog service while provider verification requests still reference it. Deactivate it instead or reassign those requests.',
      );
    }
    await this.prisma.service.delete({ where: { id } });
  }

  private async ensureCategoryExists(categoryId: string) {
    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!cat) {
      throw new BadRequestException('Unknown category id');
    }
  }
}
