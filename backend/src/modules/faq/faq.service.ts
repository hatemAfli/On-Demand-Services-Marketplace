import { Injectable, NotFoundException } from '@nestjs/common';
import { FaqAudience, Locale, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { localeFallbackChain, resolveLocale } from '../../common/i18n/locale';
import { CreateFaqItemDto, UpdateFaqItemDto } from './dto/admin-faq.dto';

function mapFaqForLocale(
  item: {
    id: string;
    audience: FaqAudience;
    sortOrder: number;
    translations: Array<{ locale: Locale; question: string; answer: string }>;
  },
  locale: Locale,
) {
  for (const loc of localeFallbackChain(locale)) {
    const tr = item.translations.find((t) => t.locale === loc);
    if (tr) {
      return {
        id: item.id,
        audience: item.audience,
        sortOrder: item.sortOrder,
        locale: loc,
        question: tr.question,
        answer: tr.answer,
      };
    }
  }
  return null;
}

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  listForAdmin() {
    return this.prisma.faqItem.findMany({
      include: { translations: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listPublishedForRole(role: UserRole, localeRaw?: string) {
    const locale = resolveLocale(localeRaw);
    const audiences: FaqAudience[] =
      role === UserRole.CLIENT
        ? [FaqAudience.ALL, FaqAudience.CLIENT]
        : role === UserRole.PROVIDER
          ? [FaqAudience.ALL, FaqAudience.PROVIDER]
          : [FaqAudience.ALL];

    const rows = await this.prisma.faqItem.findMany({
      where: {
        isPublished: true,
        audience: { in: audiences },
      },
      include: { translations: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows
      .map((row) => mapFaqForLocale(row, locale))
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  async create(dto: CreateFaqItemDto) {
    return this.prisma.faqItem.create({
      data: {
        audience: dto.audience,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
        translations: {
          create: [
            {
              locale: Locale.EN,
              question: dto.en.question.trim(),
              answer: dto.en.answer.trim(),
            },
            {
              locale: Locale.AR,
              question: dto.ar.question.trim(),
              answer: dto.ar.answer.trim(),
            },
          ],
        },
      },
      include: { translations: true },
    });
  }

  async update(id: string, dto: UpdateFaqItemDto) {
    const existing = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.faqItem.update({
        where: { id },
        data: {
          ...(dto.audience !== undefined ? { audience: dto.audience } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.isPublished !== undefined
            ? { isPublished: dto.isPublished }
            : {}),
        },
      });

      if (dto.en) {
        await tx.faqTranslation.upsert({
          where: { faqItemId_locale: { faqItemId: id, locale: Locale.EN } },
          create: {
            faqItemId: id,
            locale: Locale.EN,
            question: dto.en.question.trim(),
            answer: dto.en.answer.trim(),
          },
          update: {
            question: dto.en.question.trim(),
            answer: dto.en.answer.trim(),
          },
        });
      }

      if (dto.ar) {
        await tx.faqTranslation.upsert({
          where: { faqItemId_locale: { faqItemId: id, locale: Locale.AR } },
          create: {
            faqItemId: id,
            locale: Locale.AR,
            question: dto.ar.question.trim(),
            answer: dto.ar.answer.trim(),
          },
          update: {
            question: dto.ar.question.trim(),
            answer: dto.ar.answer.trim(),
          },
        });
      }
    });

    return this.prisma.faqItem.findUnique({
      where: { id },
      include: { translations: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');
    await this.prisma.faqItem.delete({ where: { id } });
    return { deleted: true };
  }
}
