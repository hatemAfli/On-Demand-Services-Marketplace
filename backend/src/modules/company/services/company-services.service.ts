import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnerType, Prisma, ProviderType, CompanyAuditAction } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.config';
import { SupabaseService } from '../../../config/supabase.config';
import { CompanyAuditService } from '../audit/company-audit.service';
import { UpdateGivenServiceDto } from './dto/update-given-service.dto';
import type { GalleryUploadFile } from './gallery-upload-file.type';

const GALLERY_BUCKET = 'gallery';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface CompanyServiceGroup {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  categoryId: string;
  coverImage: string | null;
  activeProviders: number;
  totalProviders: number;
  averagePrice: number;
  averageRating: number;
  totalReviews: number;
  totalCompletedJobs: number;
}

export interface GivenServiceSummary {
  id: string;
  price: number;
  pricingType: string;
  active: boolean;
  averageRating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  description: string | null;
  estimatedDurationMinutes: number | null;
  galleries: { id: string; imageUrl: string }[];
  provider: {
    id: string;
    photoUrl: string | null;
    tagline: string | null;
    user: { firstName: string; lastName: string; email: string; status: string };
  };
}

export interface CompanyServiceDetail {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  givenServices: GivenServiceSummary[];
}

export interface CompanyCategoryItem {
  categoryId: string;
  categoryName: string;
  serviceCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickTranslation(
  translations: { locale: string; name: string }[],
  preferred = 'EN',
): string {
  return (
    translations.find((t) => t.locale === preferred)?.name ??
    translations.find((t) => t.locale === 'AR')?.name ??
    translations[0]?.name ??
    '—'
  );
}

@Injectable()
export class CompanyServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly audit: CompanyAuditService,
  ) {}

  private assertGalleryUrlForGivenService(
    givenServiceId: string,
    imageUrl: string,
  ): void {
    const objectPath = this.supabase.parsePublicObjectPath(
      GALLERY_BUCKET,
      imageUrl,
    );
    if (!objectPath || !objectPath.startsWith(`${givenServiceId}/`)) {
      throw new BadRequestException(
        'Invalid gallery image URL for this service.',
      );
    }
  }

  // ─── Resolve company ──────────────────────────────────────────────────────

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

  private async resolveEmployeeIds(companyId: string): Promise<string[]> {
    const rows = await this.prisma.provider.findMany({
      where: { companyId, type: ProviderType.EMPLOYEE },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // ─── getCompanyServices ───────────────────────────────────────────────────

  async getCompanyServices(
    companyAdminUserId: string,
    params?: { search?: string; categoryId?: string; active?: boolean },
  ): Promise<CompanyServiceGroup[]> {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const employeeIds = await this.resolveEmployeeIds(companyId);

    if (employeeIds.length === 0) return [];

    // Build the where clause
    const where: Prisma.GivenServiceWhereInput = {
      ownerType: OwnerType.PROVIDER,
      ownerId: { in: employeeIds },
    };
    if (params?.active !== undefined) {
      where.active = params.active;
    }
    if (params?.categoryId) {
      where.service = { categoryId: params.categoryId };
    }
    if (params?.search) {
      const existingService = where.service as Prisma.ServiceWhereInput | undefined;
      where.service = {
        ...existingService,
        translations: {
          some: {
            name: { contains: params.search, mode: 'insensitive' },
          },
        },
      };
    }

    const givenServices = await this.prisma.givenService.findMany({
      where,
      include: {
        service: {
          include: {
            translations: true,
            category: {
              include: { translations: true },
            },
          },
        },
      },
    });

    // Group by serviceId
    const map = new Map<string, CompanyServiceGroup>();

    for (const gs of givenServices) {
      const svc = gs.service;
      const existing = map.get(svc.id);
      const rating = gs.averageRating ? Number(gs.averageRating) : 0;

      if (!existing) {
        map.set(svc.id, {
          serviceId: svc.id,
          serviceName: pickTranslation(svc.translations),
          categoryName: pickTranslation(svc.category.translations),
          categoryId: svc.categoryId,
          coverImage: svc.servicePhoto ?? null,
          activeProviders: gs.active ? 1 : 0,
          totalProviders: 1,
          averagePrice: gs.price,
          averageRating: rating,
          totalReviews: gs.totalReviews ?? 0,
          totalCompletedJobs: gs.totalCompletedJobs ?? 0,
        });
      } else {
        existing.totalProviders += 1;
        if (gs.active) existing.activeProviders += 1;
        existing.averagePrice += gs.price;
        existing.averageRating += rating;
        existing.totalReviews += gs.totalReviews ?? 0;
        existing.totalCompletedJobs += gs.totalCompletedJobs ?? 0;
        if (!existing.coverImage) {
          existing.coverImage = svc.servicePhoto ?? null;
        }
      }
    }

    // Finalise averages and sort
    const groups = Array.from(map.values()).map((g) => ({
      ...g,
      averagePrice:
        g.totalProviders > 0 ? g.averagePrice / g.totalProviders : 0,
      averageRating:
        g.totalProviders > 0 ? g.averageRating / g.totalProviders : 0,
    }));

    groups.sort((a, b) => b.totalProviders - a.totalProviders);
    return groups;
  }

  // ─── getCompanyServiceDetail ──────────────────────────────────────────────

  async getCompanyServiceDetail(
    companyAdminUserId: string,
    serviceId: string,
  ): Promise<CompanyServiceDetail> {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const employeeIds = await this.resolveEmployeeIds(companyId);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        translations: true,
        category: { include: { translations: true } },
      },
    });
    if (!service) throw new NotFoundException('Service not found.');

    const givenServices = await this.prisma.givenService.findMany({
      where: {
        serviceId,
        ownerType: OwnerType.PROVIDER,
        ownerId: { in: employeeIds },
      },
      include: {
        galleries: true,
        // We cannot use a direct FK to Provider since GivenService uses polymorphic
        // ownerId; resolve providers separately below.
      },
    });

    // Batch-load the providers
    const providerIds = givenServices.map((gs) => gs.ownerId);
    const providers = await this.prisma.provider.findMany({
      where: { id: { in: providerIds } },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
        _count: { select: { appointments: true, reviews: true } },
      },
    });
    const providerMap = new Map(providers.map((p) => [p.id, p]));

    const items: GivenServiceSummary[] = givenServices.map((gs) => {
      const prov = providerMap.get(gs.ownerId);
      return {
        id: gs.id,
        price: gs.price,
        pricingType: gs.pricingType,
        active: gs.active,
        averageRating: gs.averageRating ? Number(gs.averageRating) : 0,
        totalReviews: gs.totalReviews ?? 0,
        totalCompletedJobs: gs.totalCompletedJobs ?? 0,
        description: gs.description ?? null,
        estimatedDurationMinutes: gs.estimatedDurationMinutes ?? null,
        galleries: gs.galleries.map((g) => ({ id: g.id, imageUrl: g.imageUrl })),
        provider: {
          id: prov?.id ?? gs.ownerId,
          photoUrl: prov?.photoUrl ?? null,
          tagline: prov?.tagline ?? null,
          user: {
            firstName: prov?.user.firstName ?? '',
            lastName: prov?.user.lastName ?? '',
            email: prov?.user.email ?? '',
            status: prov?.user.status ?? '',
          },
        },
      };
    });

    return {
      serviceId: service.id,
      serviceName: pickTranslation(service.translations),
      categoryName: pickTranslation(service.category.translations),
      givenServices: items,
    };
  }

  // ─── getGivenServiceForEdit ───────────────────────────────────────────────

  async getGivenServiceForEdit(
    companyAdminUserId: string,
    givenServiceId: string,
  ) {
    const companyId = await this.resolveCompanyId(companyAdminUserId);

    const gs = await this.prisma.givenService.findUnique({
      where: { id: givenServiceId },
      include: {
        galleries: true,
        service: {
          include: {
            translations: true,
            category: { include: { translations: true } },
          },
        },
      },
    });

    if (!gs || gs.ownerType !== OwnerType.PROVIDER) {
      throw new NotFoundException('Given service not found.');
    }

    // Ownership check: provider must belong to this company
    const provider = await this.prisma.provider.findFirst({
      where: { id: gs.ownerId, companyId, type: ProviderType.EMPLOYEE },
      include: { user: true },
    });

    if (!provider) {
      throw new NotFoundException('Given service not found or access denied.');
    }

    return { ...gs, provider };
  }

  // ─── updateGivenService ───────────────────────────────────────────────────

  async updateGivenService(
    companyAdminUserId: string,
    givenServiceId: string,
    dto: UpdateGivenServiceDto,
    ipAddress?: string,
  ) {
    const gs = await this.getGivenServiceForEdit(companyAdminUserId, givenServiceId);
    const companyId = gs.provider.companyId!;

    const updated = await this.prisma.givenService.update({
      where: { id: givenServiceId },
      data: {
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.pricingType !== undefined && { pricingType: dto.pricingType }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.whatIsIncluded !== undefined && { whatIsIncluded: dto.whatIsIncluded }),
        ...(dto.whatIsNotIncluded !== undefined && { whatIsNotIncluded: dto.whatIsNotIncluded }),
        ...(dto.estimatedDurationMinutes !== undefined && {
          estimatedDurationMinutes: dto.estimatedDurationMinutes,
        }),
        ...(dto.minimumHours !== undefined && { minimumHours: dto.minimumHours }),
        ...(dto.advanceBookingRequiredHours !== undefined && {
          advanceBookingRequiredHours: dto.advanceBookingRequiredHours,
        }),
        ...(dto.serviceRadiusKm !== undefined && { serviceRadiusKm: dto.serviceRadiusKm }),
        ...(dto.serviceAreaNotes !== undefined && { serviceAreaNotes: dto.serviceAreaNotes }),
        ...(dto.clientMustProvide !== undefined && { clientMustProvide: dto.clientMustProvide }),
        ...(dto.toolsProvidedByProvider !== undefined && {
          toolsProvidedByProvider: dto.toolsProvidedByProvider,
        }),
        ...(dto.isAvailableImmediately !== undefined && {
          isAvailableImmediately: dto.isAvailableImmediately,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: { galleries: true },
    });

    const serviceName = pickTranslation(gs.service.translations);
    const providerName =
      `${gs.provider.user.firstName ?? ''} ${gs.provider.user.lastName ?? ''}`.trim() ||
      'provider';
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SERVICE_UPDATED,
      `${actor} updated "${serviceName}" for ${providerName}.`,
      { givenServiceId, fields: Object.keys(dto) },
      ipAddress,
    );

    return updated;
  }

  // ─── toggleGivenServiceActive ─────────────────────────────────────────────

  async toggleGivenServiceActive(
    companyAdminUserId: string,
    givenServiceId: string,
    active: boolean,
    ipAddress?: string,
  ): Promise<{ id: string; active: boolean }> {
    const gs = await this.getGivenServiceForEdit(companyAdminUserId, givenServiceId);
    const companyId = gs.provider.companyId!;

    const updated = await this.prisma.givenService.update({
      where: { id: givenServiceId },
      data: { active },
      select: { id: true, active: true },
    });

    const serviceName = pickTranslation(gs.service.translations);
    const providerName =
      `${gs.provider.user.firstName ?? ''} ${gs.provider.user.lastName ?? ''}`.trim() ||
      'provider';
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SERVICE_TOGGLED,
      `${actor} ${active ? 'enabled' : 'disabled'} "${serviceName}" for ${providerName}.`,
      { givenServiceId, active },
      ipAddress,
    );

    return updated;
  }

  // ─── addGalleryImage ──────────────────────────────────────────────────────

  async addGalleryImage(
    companyAdminUserId: string,
    givenServiceId: string,
    imageUrl: string,
    ipAddress?: string,
  ) {
    const gs = await this.getGivenServiceForEdit(companyAdminUserId, givenServiceId);
    const companyId = gs.provider.companyId!;
    const trimmed = imageUrl.trim();
    this.assertGalleryUrlForGivenService(givenServiceId, trimmed);

    const count = await this.prisma.serviceGallery.count({
      where: { givenServiceId },
    });
    if (count >= 40) {
      throw new BadRequestException('Maximum 40 gallery images');
    }

    const created = await this.prisma.serviceGallery.create({
      data: { givenServiceId, imageUrl: trimmed },
    });

    await this.logGalleryAudit(
      companyId,
      companyAdminUserId,
      pickTranslation(gs.service.translations),
      `${gs.provider.user.firstName ?? ''} ${gs.provider.user.lastName ?? ''}`.trim() ||
        'provider',
      'added a gallery image to',
      { givenServiceId, galleryId: created.id, action: 'add' },
      ipAddress,
    );

    return created;
  }

  async uploadGalleryImage(
    companyAdminUserId: string,
    givenServiceId: string,
    file: GalleryUploadFile,
    ipAddress?: string,
  ) {
    const gs = await this.getGivenServiceForEdit(companyAdminUserId, givenServiceId);
    const companyId = gs.provider.companyId!;

    const count = await this.prisma.serviceGallery.count({
      where: { givenServiceId },
    });
    if (count >= 40) {
      throw new BadRequestException('Maximum 40 gallery images');
    }

    const ext = this.galleryExtFromMime(file.mimetype, file.originalname);
    const objectPath = `${givenServiceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await this.supabase.getClient().storage
      .from(GALLERY_BUCKET)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { data: urlData } = this.supabase
      .getClient()
      .storage.from(GALLERY_BUCKET)
      .getPublicUrl(objectPath);

    const created = await this.prisma.serviceGallery.create({
      data: { givenServiceId, imageUrl: urlData.publicUrl },
    });

    await this.logGalleryAudit(
      companyId,
      companyAdminUserId,
      pickTranslation(gs.service.translations),
      `${gs.provider.user.firstName ?? ''} ${gs.provider.user.lastName ?? ''}`.trim() ||
        'provider',
      'uploaded a gallery image for',
      { givenServiceId, galleryId: created.id, action: 'upload' },
      ipAddress,
    );

    return created;
  }

  private galleryExtFromMime(mimetype: string, originalname: string): string {
    const lower = mimetype.toLowerCase();
    if (lower.includes('png')) return 'png';
    if (lower.includes('webp')) return 'webp';
    if (lower.includes('gif')) return 'gif';
    const fromName = originalname.split('.').pop()?.toLowerCase();
    if (fromName === 'png') return 'png';
    if (fromName === 'webp') return 'webp';
    if (fromName === 'gif') return 'gif';
    return 'jpg';
  }

  // ─── removeGalleryImage ───────────────────────────────────────────────────

  async removeGalleryImage(
    companyAdminUserId: string,
    galleryId: string,
    ipAddress?: string,
  ): Promise<void> {
    const companyId = await this.resolveCompanyId(companyAdminUserId);

    const gallery = await this.prisma.serviceGallery.findUnique({
      where: { id: galleryId },
      include: {
        givenService: {
          include: {
            service: { include: { translations: true } },
          },
        },
      },
    });

    if (!gallery) throw new NotFoundException('Gallery image not found.');

    if (gallery.givenService.ownerType !== OwnerType.PROVIDER) {
      throw new NotFoundException('Gallery image not found or access denied.');
    }

    const provider = await this.prisma.provider.findFirst({
      where: { id: gallery.givenService.ownerId, companyId, type: ProviderType.EMPLOYEE },
      include: { user: true },
    });

    if (!provider) {
      throw new NotFoundException('Gallery image not found or access denied.');
    }

    await this.prisma.serviceGallery.delete({ where: { id: galleryId } });
    await this.supabase.removeStorageObjectByPublicUrl(
      GALLERY_BUCKET,
      gallery.imageUrl,
    );

    const serviceName = pickTranslation(gallery.givenService.service.translations);
    const providerName =
      `${provider.user.firstName ?? ''} ${provider.user.lastName ?? ''}`.trim() ||
      'provider';
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SERVICE_GALLERY_UPDATED,
      `${actor} removed a gallery image from "${serviceName}" for ${providerName}.`,
      { givenServiceId: gallery.givenServiceId, galleryId, action: 'remove' },
      ipAddress,
    );
  }

  private async logGalleryAudit(
    companyId: string,
    companyAdminUserId: string,
    serviceName: string,
    providerName: string,
    verb: string,
    metadata: Prisma.InputJsonValue,
    ipAddress?: string,
  ) {
    const actor = await this.audit.actorFirstName(companyAdminUserId);
    await this.audit.log(
      companyId,
      companyAdminUserId,
      CompanyAuditAction.SERVICE_GALLERY_UPDATED,
      `${actor} ${verb} "${serviceName}" for ${providerName}.`,
      metadata,
      ipAddress,
    );
  }

  // ─── getCompanyCategories ─────────────────────────────────────────────────

  async getCompanyCategories(
    companyAdminUserId: string,
  ): Promise<CompanyCategoryItem[]> {
    const companyId = await this.resolveCompanyId(companyAdminUserId);
    const employeeIds = await this.resolveEmployeeIds(companyId);

    if (employeeIds.length === 0) return [];

    const givenServices = await this.prisma.givenService.findMany({
      where: {
        ownerType: OwnerType.PROVIDER,
        ownerId: { in: employeeIds },
      },
      select: {
        serviceId: true,
        service: {
          select: {
            categoryId: true,
            category: { include: { translations: true } },
          },
        },
      },
      distinct: ['serviceId'],
    });

    const categoryMap = new Map<
      string,
      { categoryName: string; serviceIds: Set<string> }
    >();

    for (const gs of givenServices) {
      const cat = gs.service.category;
      const name = pickTranslation(cat.translations);
      const existing = categoryMap.get(cat.id);
      if (!existing) {
        categoryMap.set(cat.id, {
          categoryName: name,
          serviceIds: new Set([gs.serviceId]),
        });
      } else {
        existing.serviceIds.add(gs.serviceId);
      }
    }

    return Array.from(categoryMap.entries())
      .map(([categoryId, { categoryName, serviceIds }]) => ({
        categoryId,
        categoryName,
        serviceCount: serviceIds.size,
      }))
      .sort((a, b) => b.serviceCount - a.serviceCount);
  }
}
