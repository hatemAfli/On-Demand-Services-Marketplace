import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Locale, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { localeFallbackChain } from '../../common/i18n/locale';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import type { ListServiceCategoriesAdminQueryDto } from './dto/list-service-categories-admin-query.dto';

function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : 'category';
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
export class ServiceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveForMarketplace(locale: Locale = Locale.EN) {
    const requestedLocales = localeFallbackChain(locale);
    const rows = await this.prisma.serviceCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      select: {
        id: true,
        slug: true,
        iconKey: true,
        iconUrl: true,
        sortOrder: true,
        translations: {
          where: { locale: { in: requestedLocales } },
          select: { locale: true, name: true },
        },
      },
    });

    return rows.map((row) => {
      const localized = requestedLocales
        .map((candidate) =>
          row.translations.find((translation) => translation.locale === candidate),
        )
        .find(Boolean);

      return {
        id: row.id,
        name: localized?.name ?? pickCategoryName(row.translations, requestedLocales, row.slug),
        slug: row.slug,
        iconKey: row.iconKey,
        iconUrl: row.iconUrl,
        sortOrder: row.sortOrder,
      };
    });
  }

  async listForAdmin(query: ListServiceCategoriesAdminQueryDto) {
    const where: Prisma.ServiceCategoryWhereInput = {};
    if (query.activeOnly) {
      where.active = true;
    }
    const rows = await this.prisma.serviceCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      include: {
        translations: {
          where: { locale: { in: [Locale.EN, Locale.AR] } },
          select: { locale: true, name: true },
        },
      },
    });

    return rows.map((row) => ({
      ...row,
      name: pickCategoryName(row.translations, [Locale.EN, Locale.AR], row.slug),
      translations: toCategoryTranslationMap(row.translations),
    }));
  }

  async findOneForAdmin(id: string) {
    const row = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        translations: {
          where: { locale: { in: [Locale.EN, Locale.AR] } },
          select: { locale: true, name: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Category not found');
    }
    return {
      ...row,
      name: pickCategoryName(row.translations, [Locale.EN, Locale.AR], row.slug),
      translations: toCategoryTranslationMap(row.translations),
    };
  }

  async create(dto: CreateServiceCategoryDto) {
    const enName = dto.translations?.en?.name?.trim() || dto.name?.trim();
    if (!enName) {
      throw new ConflictException('English category name is required');
    }
    const baseSlug = dto.slug?.trim() || slugifyName(enName);
    let slug = baseSlug;
    let attempt = 0;
    while (attempt < 50) {
      try {
        const created = await this.prisma.serviceCategory.create({
          data: {
            slug,
            iconKey: dto.iconKey?.trim() || null,
            iconUrl: dto.iconUrl?.trim() || null,
            sortOrder: dto.sortOrder ?? 0,
            active: dto.active ?? true,
            translations: {
              create: [
                {
                  locale: Locale.EN,
                  name: enName,
                },
                ...(dto.translations?.ar?.name?.trim()
                  ? [
                      {
                        locale: Locale.AR,
                        name: dto.translations.ar.name.trim(),
                      },
                    ]
                  : []),
              ],
            },
          },
          include: {
            translations: {
              where: { locale: { in: [Locale.EN, Locale.AR] } },
              select: { locale: true, name: true },
            },
          },
        });
        return {
          ...created,
          name: pickCategoryName(created.translations, [Locale.EN, Locale.AR], created.slug),
          translations: toCategoryTranslationMap(created.translations),
        };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          attempt += 1;
          slug = `${baseSlug}-${attempt}`;
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException('Could not allocate a unique slug');
  }

  async update(id: string, dto: UpdateServiceCategoryDto) {
    await this.ensureExists(id);
    const data: Prisma.ServiceCategoryUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug.trim();
    if (dto.iconKey !== undefined) {
      const t = dto.iconKey.trim();
      data.iconKey = t === '' ? null : t;
    }
    if (dto.iconUrl !== undefined) {
      const t = dto.iconUrl.trim();
      data.iconUrl = t === '' ? null : t;
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.active !== undefined) data.active = dto.active;
    const enName = dto.translations?.en?.name?.trim() || dto.name?.trim();
    const arName = dto.translations?.ar?.name?.trim();
    try {
      const updated = await this.prisma.serviceCategory.update({
        where: { id },
        data,
        include: {
          translations: {
            where: { locale: { in: [Locale.EN, Locale.AR] } },
            select: { locale: true, name: true },
          },
        },
      });
      if (enName !== undefined) {
        await this.prisma.serviceCategoryTranslation.upsert({
          where: { categoryId_locale: { categoryId: id, locale: Locale.EN } },
          update: { name: enName },
          create: {
            categoryId: id,
            locale: Locale.EN,
            name: enName,
          },
        });
      }
      if (dto.translations?.ar !== undefined) {
        if (arName) {
          await this.prisma.serviceCategoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: id, locale: Locale.AR } },
            update: { name: arName },
            create: {
              categoryId: id,
              locale: Locale.AR,
              name: arName,
            },
          });
        } else {
          await this.prisma.serviceCategoryTranslation.deleteMany({
            where: { categoryId: id, locale: Locale.AR },
          });
        }
      }
      return {
        ...updated,
        name: pickCategoryName(updated.translations, [Locale.EN, Locale.AR], updated.slug),
        translations: toCategoryTranslationMap(
          await this.prisma.serviceCategoryTranslation.findMany({
            where: { categoryId: id, locale: { in: [Locale.EN, Locale.AR] } },
            select: { locale: true, name: true },
          }),
        ),
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Slug already in use');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const count = await this.prisma.service.count({
      where: { categoryId: id },
    });
    if (count > 0) {
      throw new ConflictException(
        'This category still has services. Reassign or remove those services first.',
      );
    }
    await this.prisma.serviceCategory.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const row = await this.prisma.serviceCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Category not found');
    }
  }
}
