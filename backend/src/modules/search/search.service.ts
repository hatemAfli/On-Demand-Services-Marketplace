import { Injectable } from '@nestjs/common';
import { Locale, OwnerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';
import {
  SearchGivenServicesDto,
  SortOption,
} from './dto/search-given-services.dto';
import {
  OwnerSnapshot,
  SearchResponse,
  SearchResultItem,
} from './dto/search-result.dto';

type GivenServiceWithRelations = Prisma.GivenServiceGetPayload<{
  include: {
    service: {
      include: {
        translations: true;
        category: {
          include: {
            translations: true;
          };
        };
      };
    };
    galleries: true;
  };
}>;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchGivenServicesDto): Promise<SearchResponse> {
    const locale: Locale = dto.locale?.toUpperCase() === 'AR' ? 'AR' : 'EN';

    // Note: we do NOT filter by ownerType at the DB level. Employee providers are
    // hidden as individuals and surfaced through their company instead, so the
    // owner-type decision is made after grouping (see below).
    const where: Prisma.GivenServiceWhereInput = {
      active: true,
      serviceId: dto.serviceId,
      ...(dto.pricingType ? { pricingType: dto.pricingType } : {}),
      ...(dto.maxPrice !== undefined ? { price: { lte: dto.maxPrice } } : {}),
      ...(dto.minRating !== undefined
        ? { averageRating: { gte: dto.minRating } }
        : {}),
      ...(dto.isAvailableImmediately ? { isAvailableImmediately: true } : {}),
    };

    const givenServices = await this.prisma.givenService.findMany({
      where,
      include: {
        service: {
          include: {
            translations: {
              where: { locale },
            },
            category: {
              include: {
                translations: {
                  where: { locale },
                },
              },
            },
          },
        },
        // Schema has no gallery createdAt; deterministic order by id.
        galleries: {
          take: 3,
          orderBy: { id: 'asc' },
        },
      },
    });

    // Batch-load all provider owners (polymorphic — no FK), with full scalar fields.
    const providerOwnerIds = Array.from(
      new Set(
        givenServices
          .filter((gs) => gs.ownerType === OwnerType.PROVIDER)
          .map((gs) => gs.ownerId),
      ),
    );
    const providers = providerOwnerIds.length
      ? await this.prisma.provider.findMany({
          where: { id: { in: providerOwnerIds } },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
      : [];
    const providerMap = new Map(providers.map((p) => [p.id, p]));

    // Independent providers are shown individually. Employee providers and any
    // company-owned offerings are grouped per company into a single entry.
    const independentItems: SearchResultItem[] = [];
    const companyEntries = new Map<
      string,
      { gs: GivenServiceWithRelations }[]
    >();

    for (const gs of givenServices) {
      if (gs.ownerType === OwnerType.COMPANY) {
        const list = companyEntries.get(gs.ownerId) ?? [];
        list.push({ gs });
        companyEntries.set(gs.ownerId, list);
        continue;
      }

      const provider = providerMap.get(gs.ownerId);
      if (!provider) continue;

      if (provider.companyId) {
        // Employee provider → fold into the company group.
        const list = companyEntries.get(provider.companyId) ?? [];
        list.push({ gs });
        companyEntries.set(provider.companyId, list);
      } else {
        const item = this.mapToSearchResultItem(gs, provider, dto);
        if (item) independentItems.push(item);
      }
    }

    // Synthesize one COMPANY item per company group.
    const companyItems: SearchResultItem[] = [];
    if (companyEntries.size > 0) {
      const companies = await this.prisma.company.findMany({
        where: { id: { in: Array.from(companyEntries.keys()) } },
      });
      const companyMap = new Map(companies.map((c) => [c.id, c]));
      for (const [companyId, entries] of companyEntries) {
        const company = companyMap.get(companyId);
        if (!company) continue;
        const item = this.synthesizeCompanyItem(company, entries, dto);
        if (item) companyItems.push(item);
      }
    }

    const mapped = [...independentItems, ...companyItems];

    const filtered = mapped.filter((item) => {
      if (dto.ownerType && item.owner.type !== dto.ownerType) {
        return false;
      }

      if (dto.city && item.owner.city.toLowerCase() !== dto.city.toLowerCase()) {
        return false;
      }

      if (dto.gender) {
        if (item.owner.type !== 'PROVIDER') return false;
        if (item.owner.gender !== dto.gender) return false;
      }

      if (dto.isTopProvider) {
        if (item.owner.type !== 'PROVIDER') return false;
        if (!item.owner.isTopProvider) return false;
      }

      return true;
    });

    const withScore = filtered.map((item) => ({
      ...item,
      _score: this.computeScore(item, dto),
    }));

    const sortOption = (dto.sort?.toUpperCase() as SortOption) ?? SortOption.RECOMMENDED;
    const sorted = [...withScore].sort((a, b) => {
      switch (sortOption) {
        case SortOption.RATING_DESC:
          return b.averageRating - a.averageRating;
        case SortOption.PRICE_ASC:
          return a.price - b.price;
        case SortOption.PRICE_DESC:
          return b.price - a.price;
        case SortOption.JOBS_DESC:
          return b.totalCompletedJobs - a.totalCompletedJobs;
        case SortOption.NEWEST:
          return b.createdAt.getTime() - a.createdAt.getTime();
        case SortOption.RECOMMENDED:
        default:
          return b._score - a._score;
      }
    });

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const start = (page - 1) * limit;
    const paged = sorted.slice(start, start + limit);

    return {
      items: paged,
      total: sorted.length,
      page,
      limit,
      totalPages: Math.ceil(sorted.length / limit),
    };
  }

  private mapToSearchResultItem(
    gs: GivenServiceWithRelations,
    owner: {
      id: string;
      city?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      averageRating?: Prisma.Decimal | number | null;
      totalReviews?: number | null;
      photoUrl?: string | null;
      logo?: string | null;
      isTopProvider?: boolean | null;
      yearsOfExperience?: number | null;
      tagline?: string | null;
      cancellationRate?: Prisma.Decimal | number | null;
      averageResponseTime?: Prisma.Decimal | number | null;
      gender?: string | null;
      languagesSpoken?: string[] | null;
      paymentMethodsAccepted?: string[] | null;
      companyName?: string | null;
      user?: {
        firstName?: string | null;
        lastName?: string | null;
      };
    } | null,
    dto: SearchGivenServicesDto,
  ): SearchResultItem | null {
    if (!owner) return null;

    const isProviderOwner = gs.ownerType === OwnerType.PROVIDER;
    const ownerSnapshot: OwnerSnapshot = isProviderOwner
      ? {
          id: owner.id,
          type: 'PROVIDER',
          displayName:
            `${owner.user?.firstName ?? ''} ${owner.user?.lastName ?? ''}`.trim() ||
            'Provider',
          photoUrl: owner.photoUrl ?? null,
          city: owner.city ?? '',
          latitude: owner.latitude ?? null,
          longitude: owner.longitude ?? null,
          averageRating: Number(owner.averageRating ?? 0),
          totalReviews: Number(owner.totalReviews ?? 0),
          isTopProvider: Boolean(owner.isTopProvider),
          yearsOfExperience: owner.yearsOfExperience ?? null,
          tagline: owner.tagline ?? null,
          cancellationRate: Number(owner.cancellationRate ?? 0),
          averageResponseTime:
            owner.averageResponseTime !== undefined &&
            owner.averageResponseTime !== null
              ? Number(owner.averageResponseTime)
              : null,
          gender: owner.gender ?? null,
          languagesSpoken: owner.languagesSpoken ?? [],
          paymentMethodsAccepted: owner.paymentMethodsAccepted ?? [],
        }
      : {
          id: owner.id,
          type: 'COMPANY',
          displayName: owner.companyName ?? 'Company',
          photoUrl: owner.logo ?? null,
          city: owner.city ?? '',
          latitude: owner.latitude ?? null,
          longitude: owner.longitude ?? null,
          averageRating: Number(owner.averageRating ?? 0),
          totalReviews: Number(owner.totalReviews ?? 0),
          isTopProvider: false,
          yearsOfExperience: null,
          tagline: null,
          cancellationRate: Number(owner.cancellationRate ?? 0),
          averageResponseTime:
            owner.averageResponseTime !== undefined &&
            owner.averageResponseTime !== null
              ? Number(owner.averageResponseTime)
              : null,
          gender: null,
          languagesSpoken: [],
          paymentMethodsAccepted: [],
        };

    return {
      givenServiceId: gs.id,
      createdAt: gs.createdAt,
      serviceId: gs.serviceId,
      serviceName: gs.service.translations[0]?.name ?? '',
      categoryName: gs.service.category.translations[0]?.name ?? '',
      pricingType: gs.pricingType,
      price: gs.price,
      minimumHours: gs.minimumHours ?? null,
      estimatedDurationMinutes: gs.estimatedDurationMinutes ?? null,
      description: gs.description ?? null,
      whatIsIncluded: gs.whatIsIncluded ?? null,
      whatIsNotIncluded: gs.whatIsNotIncluded ?? null,
      toolsProvidedByProvider: gs.toolsProvidedByProvider ?? null,
      isAvailableImmediately: gs.isAvailableImmediately ?? null,
      averageRating: Number(gs.averageRating ?? 0),
      totalReviews: Number(gs.totalReviews ?? 0),
      totalCompletedJobs: Number(gs.totalCompletedJobs ?? 0),
      serviceRadiusKm: gs.serviceRadiusKm ?? null,
      galleries: gs.galleries.map((g) => ({
        id: g.id,
        imageUrl: g.imageUrl,
      })),
      owner: ownerSnapshot,
      _score: 0,
    };
  }

  /**
   * Builds a single COMPANY search entry from all of a company's offerings for
   * the searched service. Price is the lowest active offering ("from X"),
   * jobs are summed, and the company's own rating/logo are used.
   */
  private synthesizeCompanyItem(
    company: {
      id: string;
      companyName: string;
      logo: string | null;
      city: string;
      latitude: number | null;
      longitude: number | null;
      averageRating: Prisma.Decimal | number | null;
      totalReviews: number;
      cancellationRate: Prisma.Decimal | number | null;
      averageResponseTime: Prisma.Decimal | number | null;
    },
    entries: { gs: GivenServiceWithRelations }[],
    _dto: SearchGivenServicesDto,
  ): SearchResultItem | null {
    if (entries.length === 0) return null;

    // Representative offering = the cheapest active one (drives "from" price + copy).
    const sorted = [...entries].sort((a, b) => a.gs.price - b.gs.price);
    const rep = sorted[0].gs;

    const totalCompletedJobs = entries.reduce(
      (sum, e) => sum + Number(e.gs.totalCompletedJobs ?? 0),
      0,
    );
    const isAvailableImmediately = entries.some(
      (e) => e.gs.isAvailableImmediately === true,
    );

    const ownerSnapshot: OwnerSnapshot = {
      id: company.id,
      type: 'COMPANY',
      displayName: company.companyName || 'Company',
      photoUrl: company.logo ?? null,
      city: company.city ?? '',
      latitude: company.latitude ?? null,
      longitude: company.longitude ?? null,
      averageRating: Number(company.averageRating ?? 0),
      totalReviews: Number(company.totalReviews ?? 0),
      isTopProvider: false,
      yearsOfExperience: null,
      tagline: null,
      cancellationRate: Number(company.cancellationRate ?? 0),
      averageResponseTime:
        company.averageResponseTime !== null &&
        company.averageResponseTime !== undefined
          ? Number(company.averageResponseTime)
          : null,
      gender: null,
      languagesSpoken: [],
      paymentMethodsAccepted: [],
    };

    return {
      givenServiceId: rep.id,
      createdAt: rep.createdAt,
      serviceId: rep.serviceId,
      serviceName: rep.service.translations[0]?.name ?? '',
      categoryName: rep.service.category.translations[0]?.name ?? '',
      pricingType: rep.pricingType,
      price: rep.price,
      minimumHours: rep.minimumHours ?? null,
      estimatedDurationMinutes: rep.estimatedDurationMinutes ?? null,
      description: rep.description ?? null,
      whatIsIncluded: rep.whatIsIncluded ?? null,
      whatIsNotIncluded: rep.whatIsNotIncluded ?? null,
      toolsProvidedByProvider: rep.toolsProvidedByProvider ?? null,
      isAvailableImmediately,
      averageRating: Number(company.averageRating ?? 0),
      totalReviews: Number(company.totalReviews ?? 0),
      totalCompletedJobs,
      serviceRadiusKm: rep.serviceRadiusKm ?? null,
      galleries: [],
      owner: ownerSnapshot,
      providerCount: entries.length,
      _score: 0,
    };
  }

  private computeScore(item: SearchResultItem, dto: SearchGivenServicesDto): number {
    const ratingScore = item.averageRating / 5.0;

    let distanceScore = 0.5;
    if (
      dto.clientLat !== undefined &&
      dto.clientLng !== undefined &&
      item.owner.latitude !== null &&
      item.owner.longitude !== null
    ) {
      const distance = this.haversineKm(
        dto.clientLat,
        dto.clientLng,
        item.owner.latitude,
        item.owner.longitude,
      );
      const radius = item.serviceRadiusKm ?? 30;
      distanceScore = Math.max(0, 1 - distance / radius);
    }

    const jobsScore = Math.min(item.totalCompletedJobs / 100, 1.0);
    const cancelPenalty = item.owner.cancellationRate / 100;
    const reputationScore = jobsScore * 0.7 - cancelPenalty * 0.3;

    const availScore =
      (item.isAvailableImmediately ? 1.0 : 0.5) +
      (item.owner.isTopProvider ? 0.2 : 0.0);

    const rt = item.owner.averageResponseTime ?? 120;
    const responseScore = Math.max(0, 1 - rt / 240);

    return (
      0.35 * ratingScore +
      0.25 * distanceScore +
      0.2 * reputationScore +
      0.12 * availScore +
      0.08 * responseScore
    );
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const r = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return r * c;
  }
}
