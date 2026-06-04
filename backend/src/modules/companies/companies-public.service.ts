import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale, OwnerType, ProviderType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.config';

export interface CompanyProfileProvider {
  /** Provider id (= User id). Used as `providerId` when the client preselects. */
  id: string;
  givenServiceId: string;
  displayName: string;
  photoUrl: string | null;
  tagline: string | null;
  city: string;
  averageRating: number;
  totalReviews: number;
  isTopProvider: boolean;
  gender: string | null;
  yearsOfExperience: number | null;
  pricingType: string;
  price: number;
  estimatedDurationMinutes: number | null;
  isAvailableImmediately: boolean | null;
}

@Injectable()
export class CompaniesPublicService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public company profile for the client marketplace. When `serviceId` is
   * provided, the returned `providers` are exactly the company's employees who
   * actively offer that service (used for preselection + booking).
   */
  async getCompanyProfile(
    companyId: string,
    serviceId?: string,
    localeInput?: string,
  ) {
    const locale: Locale = localeInput?.toUpperCase() === 'AR' ? 'AR' : 'EN';

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        logo: true,
        city: true,
        address: true,
        latitude: true,
        longitude: true,
        serviceZones: true,
        email: true,
        averageRating: true,
        totalReviews: true,
        createdAt: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    // All employees of the company.
    const employees = await this.prisma.provider.findMany({
      where: { companyId, type: ProviderType.EMPLOYEE },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const employeeIds = employees.map((e) => e.id);

    let serviceName: string | null = null;
    let categoryName: string | null = null;
    const providers: CompanyProfileProvider[] = [];

    if (serviceId && employeeIds.length > 0) {
      const givenServices = await this.prisma.givenService.findMany({
        where: {
          serviceId,
          active: true,
          ownerType: OwnerType.PROVIDER,
          ownerId: { in: employeeIds },
        },
        include: {
          service: {
            include: {
              translations: { where: { locale } },
              category: { include: { translations: { where: { locale } } } },
            },
          },
        },
      });

      for (const gs of givenServices) {
        const emp = employeeMap.get(gs.ownerId);
        if (!emp) continue;
        if (!serviceName) {
          serviceName = gs.service.translations[0]?.name ?? null;
          categoryName = gs.service.category.translations[0]?.name ?? null;
        }
        providers.push({
          id: emp.id,
          givenServiceId: gs.id,
          displayName:
            `${emp.user?.firstName ?? ''} ${emp.user?.lastName ?? ''}`.trim() ||
            'Provider',
          photoUrl: emp.photoUrl ?? null,
          tagline: emp.tagline ?? null,
          city: emp.city ?? '',
          averageRating: Number(gs.averageRating ?? emp.averageRating ?? 0),
          totalReviews: Number(gs.totalReviews ?? 0),
          isTopProvider: Boolean(emp.isTopProvider),
          gender: emp.gender ?? null,
          yearsOfExperience: emp.yearsOfExperience ?? null,
          pricingType: gs.pricingType,
          price: gs.price,
          estimatedDurationMinutes: gs.estimatedDurationMinutes ?? null,
          isAvailableImmediately: gs.isAvailableImmediately ?? null,
        });
      }

      providers.sort((a, b) => a.price - b.price);
    }

    const fromPrice =
      providers.length > 0
        ? Math.min(...providers.map((p) => p.price))
        : null;

    return {
      id: company.id,
      companyName: company.companyName,
      logo: company.logo ?? null,
      city: company.city ?? '',
      address: company.address ?? null,
      latitude: company.latitude ?? null,
      longitude: company.longitude ?? null,
      serviceZones: company.serviceZones ?? [],
      email: company.email ?? null,
      averageRating: Number(company.averageRating ?? 0),
      totalReviews: Number(company.totalReviews ?? 0),
      totalEmployees: employees.length,
      memberSince: company.createdAt,
      service: serviceId
        ? {
            serviceId,
            serviceName,
            categoryName,
            fromPrice,
            providerCount: providers.length,
          }
        : null,
      providers,
    };
  }
}
