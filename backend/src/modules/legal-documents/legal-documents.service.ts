import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LegalDocumentStatus,
  LegalDocumentType,
  Locale,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import { localeFallbackChain } from '../../common/i18n/locale';
import { AddLegalDocumentVersionDto } from './dto/add-legal-document-version.dto';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { PatchLegalDocumentVersionDto } from './dto/patch-legal-document-version.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';

@Injectable()
export class LegalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  listForAdmin() {
    return this.prisma.legalDocument.findMany({
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            translations: true,
          },
        },
      },
      orderBy: { type: 'asc' },
    });
  }

  async getLatestPublished(type: LegalDocumentType, locale: Locale) {
    const doc = await this.prisma.legalDocument.findUnique({
      where: { type },
    });
    if (!doc) return null;

    for (const loc of localeFallbackChain(locale)) {
      const version = await this.prisma.legalDocumentVersion.findFirst({
        where: {
          documentId: doc.id,
          status: LegalDocumentStatus.PUBLISHED,
          translations: { some: { locale: loc } },
        },
        orderBy: { version: 'desc' },
      });

      if (!version) continue;

      const tr = await this.prisma.legalDocumentTranslation.findFirst({
        where: { documentVersionId: version.id, locale: loc },
      });

      if (!tr) continue;

      return {
        type: doc.type,
        locale: loc,
        title: tr.title,
        version: version.version,
        contentMarkdown: tr.contentMarkdown,
        summary: tr.summary,
        publishedAt: version.publishedAt,
        documentId: doc.id,
        versionId: version.id,
      };
    }

    return null;
  }

  async create(dto: CreateLegalDocumentDto, createdByAdminId: string) {
    const existing = await this.prisma.legalDocument.findUnique({
      where: { type: dto.type },
    });
    if (existing) {
      throw new ConflictException('A legal document already exists for this type');
    }

    const publish = dto.publish === true;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.legalDocument.create({
        data: {
          type: dto.type,
          currentVersion: publish ? 1 : 0,
        },
      });

      const version = await tx.legalDocumentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          status: publish ? LegalDocumentStatus.PUBLISHED : LegalDocumentStatus.DRAFT,
          publishedAt: publish ? now : null,
          createdByAdminId,
        },
      });

      await tx.legalDocumentTranslation.createMany({
        data: [
          {
            documentVersionId: version.id,
            locale: Locale.EN,
            title: dto.titleEn,
            contentMarkdown: dto.contentEn,
            summary: dto.summaryEn ?? null,
          },
          {
            documentVersionId: version.id,
            locale: Locale.AR,
            title: dto.titleAr,
            contentMarkdown: dto.contentAr,
            summary: dto.summaryAr ?? null,
          },
        ],
      });

      return tx.legalDocument.findUniqueOrThrow({
        where: { id: doc.id },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { translations: true },
          },
        },
      });
    });
  }

  async updateDocument(documentId: string, dto: UpdateLegalDocumentDto) {
    if (dto.titleEn === undefined && dto.titleAr === undefined) {
      throw new BadRequestException('No fields to update');
    }

    const version = await this.prisma.legalDocumentVersion.findFirst({
      where: { documentId, status: LegalDocumentStatus.DRAFT },
      orderBy: { version: 'desc' },
      include: {
        translations: {
          where: { locale: { in: [Locale.EN, Locale.AR] } },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('No draft version found for this document');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.titleEn !== undefined) {
        const res = await tx.legalDocumentTranslation.updateMany({
          where: { documentVersionId: version.id, locale: Locale.EN },
          data: { title: dto.titleEn },
        });
        if (res.count === 0) {
          throw new NotFoundException('English translation not found');
        }
      }

      if (dto.titleAr !== undefined) {
        const res = await tx.legalDocumentTranslation.updateMany({
          where: { documentVersionId: version.id, locale: Locale.AR },
          data: { title: dto.titleAr },
        });
        if (res.count === 0) {
          throw new NotFoundException('Arabic translation not found');
        }
      }

      return tx.legalDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { translations: true },
          },
        },
      });
    });
  }

  async addVersion(
    documentId: string,
    dto: AddLegalDocumentVersionDto,
    createdByAdminId: string,
  ) {
    const doc = await this.prisma.legalDocument.findUnique({
      where: { id: documentId },
      select: { id: true, currentVersion: true },
    });
    if (!doc) throw new NotFoundException('Legal document not found');

    const agg = await this.prisma.legalDocumentVersion.aggregate({
      where: { documentId },
      _max: { version: true },
    });
    const nextVersion = (agg._max.version ?? 0) + 1;
    const publish = dto.publish === true;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (publish) {
        await tx.legalDocumentVersion.updateMany({
          where: {
            documentId,
            status: LegalDocumentStatus.PUBLISHED,
          },
          data: { status: LegalDocumentStatus.ARCHIVED },
        });
      }

      const version = await tx.legalDocumentVersion.create({
        data: {
          documentId,
          version: nextVersion,
          status: publish ? LegalDocumentStatus.PUBLISHED : LegalDocumentStatus.DRAFT,
          publishedAt: publish ? now : null,
          createdByAdminId,
        },
      });

      await tx.legalDocumentTranslation.createMany({
        data: [
          {
            documentVersionId: version.id,
            locale: Locale.EN,
            title: dto.titleEn,
            contentMarkdown: dto.contentEn,
            summary: dto.summaryEn ?? null,
          },
          {
            documentVersionId: version.id,
            locale: Locale.AR,
            title: dto.titleAr,
            contentMarkdown: dto.contentAr,
            summary: dto.summaryAr ?? null,
          },
        ],
      });

      await tx.legalDocument.update({
        where: { id: documentId },
        data: {
          currentVersion: publish ? nextVersion : doc.currentVersion,
        },
      });

      return tx.legalDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { translations: true },
          },
        },
      });
    });
  }

  async patchVersion(
    documentId: string,
    versionId: string,
    dto: PatchLegalDocumentVersionDto,
    createdByAdminId: string,
  ) {
    const version = await this.prisma.legalDocumentVersion.findFirst({
      where: { id: versionId, documentId },
      select: { id: true, version: true, status: true },
    });
    if (!version) throw new NotFoundException('Version not found');

    const publish = dto.publish === true;
    const hasAnyChanges =
      dto.titleEn !== undefined ||
      dto.contentEn !== undefined ||
      dto.summaryEn !== undefined ||
      dto.titleAr !== undefined ||
      dto.contentAr !== undefined ||
      dto.summaryAr !== undefined;

    if (publish && version.status !== LegalDocumentStatus.DRAFT) {
      throw new BadRequestException('Only a draft can be published');
    }

    if (!publish && !hasAnyChanges) {
      throw new BadRequestException('No changes requested');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (hasAnyChanges) {
        if (version.status !== LegalDocumentStatus.DRAFT) {
          throw new BadRequestException('Only draft content can be edited');
        }

        const enData: Partial<{
          title: string;
          contentMarkdown: string;
          summary: string | null;
        }> = {};

        if (dto.titleEn !== undefined) enData.title = dto.titleEn;
        if (dto.contentEn !== undefined) enData.contentMarkdown = dto.contentEn;
        if (dto.summaryEn !== undefined) enData.summary = dto.summaryEn ?? null;

        if (Object.keys(enData).length > 0) {
          const res = await tx.legalDocumentTranslation.updateMany({
            where: { documentVersionId: versionId, locale: Locale.EN },
            data: enData as any,
          });
          if (res.count === 0) throw new NotFoundException('English translation not found');
        }

        const arData: Partial<{
          title: string;
          contentMarkdown: string;
          summary: string | null;
        }> = {};

        if (dto.titleAr !== undefined) arData.title = dto.titleAr;
        if (dto.contentAr !== undefined) arData.contentMarkdown = dto.contentAr;
        if (dto.summaryAr !== undefined) arData.summary = dto.summaryAr ?? null;

        if (Object.keys(arData).length > 0) {
          const res = await tx.legalDocumentTranslation.updateMany({
            where: { documentVersionId: versionId, locale: Locale.AR },
            data: arData as any,
          });
          if (res.count === 0) throw new NotFoundException('Arabic translation not found');
        }
      }

      if (publish) {
        await tx.legalDocumentVersion.updateMany({
          where: {
            documentId,
            status: LegalDocumentStatus.PUBLISHED,
          },
          data: { status: LegalDocumentStatus.ARCHIVED },
        });

        await tx.legalDocumentVersion.update({
          where: { id: versionId },
          data: {
            status: LegalDocumentStatus.PUBLISHED,
            publishedAt: now,
            createdByAdminId,
          },
        });

        await tx.legalDocument.update({
          where: { id: documentId },
          data: { currentVersion: version.version },
        });
      }

      return tx.legalDocument.findUniqueOrThrow({
        where: { id: documentId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { translations: true },
          },
        },
      });
    });
  }

  async remove(documentId: string) {
    const result = await this.prisma.legalDocument.deleteMany({
      where: { id: documentId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Legal document not found');
    }
  }
}
