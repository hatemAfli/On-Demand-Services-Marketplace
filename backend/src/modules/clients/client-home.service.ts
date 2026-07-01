import { Injectable, NotFoundException } from '@nestjs/common';
import { Locale } from '@prisma/client';
import { RedisService } from '../../config/redis.service';
import { PrismaService } from '../../config/prisma.config';
import { SortOption } from '../search/dto/search-given-services.dto';
import { SearchService } from '../search/search.service';
import { ServicesService } from '../services/services.service';

export type PopularNearbyItem = {
  ownerId: string;
  ownerType: 'PROVIDER' | 'COMPANY';
  givenServiceId: string;
  serviceId: string;
  serviceName: string;
  displayName: string;
  imageUrl: string | null;
  city: string;
  rating: number;
  distanceKm: number | null;
  isTopProvider: boolean;
  isAvailableImmediately: boolean;
};

@Injectable()
export class ClientHomeService {
  private readonly cacheTtlSeconds = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly searchService: SearchService,
    private readonly servicesService: ServicesService,
  ) {}

  async getPopularNearby(
    userId: string,
    locale: Locale,
    clientLat?: number,
    clientLng?: number,
  ): Promise<PopularNearbyItem[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
      select: { city: true },
    });
    if (!client) {
      throw new NotFoundException('Client profile not found');
    }

    const cityKey = (client.city ?? 'unknown').trim().toLowerCase() || 'unknown';
    const latKey =
      clientLat != null && Number.isFinite(clientLat)
        ? clientLat.toFixed(2)
        : 'na';
    const lngKey =
      clientLng != null && Number.isFinite(clientLng)
        ? clientLng.toFixed(2)
        : 'na';
    const cacheKey = `cache:user:${userId}:popular-nearby:${locale}:${cityKey}:${latKey}:${lngKey}`;

    return this.redis.getOrSetJson(cacheKey, this.cacheTtlSeconds, () =>
      this.computePopularNearby(
        userId,
        locale,
        client.city,
        clientLat,
        clientLng,
      ),
    );
  }

  async invalidatePopularNearbyCache(userId: string): Promise<void> {
    await this.redis.invalidatePattern(`cache:user:${userId}:popular-nearby:`);
  }

  private async computePopularNearby(
    userId: string,
    locale: Locale,
    city: string | null,
    clientLat?: number,
    clientLng?: number,
  ): Promise<PopularNearbyItem[]> {
    const [historyRows, appointmentRows, services] = await Promise.all([
      this.prisma.clientSearchHistory.findMany({
        where: { clientId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          service: { select: { id: true, translations: { where: { locale } } } },
        },
      }),
      this.prisma.appointment.findMany({
        where: { clientId: userId },
        orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
        take: 20,
        select: {
          givenService: { select: { id: true, serviceId: true } },
        },
      }),
      this.servicesService.findAll({ locale }),
    ]);

    const serviceNameById = new Map(
      services.map((s) => [s.id, s.name] as const),
    );

    const serviceSignals: string[] = [];
    for (const row of historyRows) {
      if (row.service?.id) serviceSignals.push(row.service.id);
    }
    for (const row of appointmentRows) {
      const gsId = row.givenService?.serviceId;
      if (gsId) serviceSignals.push(gsId);
    }
    if (serviceSignals.length === 0) {
      serviceSignals.push(...services.slice(0, 3).map((s) => s.id));
    }
    const uniqServiceIds = [...new Set(serviceSignals)].slice(0, 4);

    const searchResponses = await Promise.all(
      uniqServiceIds.map((serviceId) =>
        this.searchService.search({
          serviceId,
          clientLat,
          clientLng,
          city: city ?? undefined,
          sort: SortOption.RECOMMENDED,
          locale,
          page: 1,
          limit: 6,
        }),
      ),
    );

    const byOwner = new Map<string, PopularNearbyItem>();
    for (let i = 0; i < searchResponses.length; i += 1) {
      const serviceId = uniqServiceIds[i];
      const serviceName = serviceNameById.get(serviceId) ?? 'Service';
      for (const row of searchResponses[i].items) {
        const key = `${row.owner.type}:${row.owner.id}`;
        const distanceKm =
          clientLat != null &&
          clientLng != null &&
          row.owner.latitude != null &&
          row.owner.longitude != null
            ? this.haversineKm(
                clientLat,
                clientLng,
                row.owner.latitude,
                row.owner.longitude,
              )
            : null;
        const mapped: PopularNearbyItem = {
          ownerId: row.owner.id,
          ownerType: row.owner.type,
          givenServiceId: row.givenServiceId,
          serviceId,
          serviceName: row.serviceName || serviceName,
          displayName: row.owner.displayName,
          imageUrl: row.owner.photoUrl,
          city: row.owner.city,
          rating: Number(row.averageRating || 0),
          distanceKm,
          isTopProvider: Boolean(row.owner.isTopProvider),
          isAvailableImmediately: Boolean(row.isAvailableImmediately),
        };
        const existing = byOwner.get(key);
        if (!existing) {
          byOwner.set(key, mapped);
          continue;
        }
        const existingScore =
          existing.rating * 10 -
          (existing.distanceKm ?? 5) +
          (existing.isTopProvider ? 1 : 0);
        const nextScore =
          mapped.rating * 10 -
          (mapped.distanceKm ?? 5) +
          (mapped.isTopProvider ? 1 : 0);
        if (nextScore > existingScore) byOwner.set(key, mapped);
      }
    }

    return [...byOwner.values()]
      .sort((a, b) => {
        const dA = a.distanceKm ?? 999;
        const dB = b.distanceKm ?? 999;
        if (dA !== dB) return dA - dB;
        return b.rating - a.rating;
      })
      .slice(0, 5);
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
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return r * c;
  }
}
