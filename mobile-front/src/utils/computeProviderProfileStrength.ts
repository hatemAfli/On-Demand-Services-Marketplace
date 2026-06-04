import type { UserWithProfile } from "../types";

export type ProfileStrengthGivenService = {
  serviceId: string;
  serviceName: string;
  servicePhoto?: string | null;
  description?: string | null;
  price?: number | null;
  whatIsIncluded?: string | null;
  serviceAreaNotes?: string | null;
  clientMustProvide?: string | null;
  estimatedDurationMinutes?: number | null;
  minimumHours?: number | null;
  serviceRadiusKm?: number | null;
  galleryCount: number;
};

export type ProfileStrengthFixAction =
  | "edit-profile"
  | "documents"
  | "manage-service";

export type ProfileStrengthMissingItem = {
  id: string;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  action: ProfileStrengthFixAction;
  serviceId?: string;
  serviceName?: string;
  weight: number;
};

export type ProfileStrengthResult = {
  percent: number;
  missingItems: ProfileStrengthMissingItem[];
  breakdown: {
    personal: number;
    services: number;
  };
};

const PERSONAL_MAX = 55;
const SERVICES_MAX = 45;

function hasText(value: string | null | undefined, minLen = 1): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed.length >= minLen);
}

function computePersonalScore(
  profile: UserWithProfile | null | undefined,
): { score: number; missing: ProfileStrengthMissingItem[] } {
  const provider = profile?.provider;
  let score = 0;
  const missing: ProfileStrengthMissingItem[] = [];

  const checks: Array<{
    id: string;
    labelKey: string;
    weight: number;
    done: boolean;
  }> = [
    {
      id: "photo",
      labelKey: "provider.profileDocuments.strengthMissingPhoto",
      weight: 12,
      done: hasText(provider?.photoUrl),
    },
    {
      id: "city",
      labelKey: "provider.profileDocuments.strengthMissingCity",
      weight: 9,
      done: hasText(provider?.city),
    },
    {
      id: "address",
      labelKey: "provider.profileDocuments.strengthMissingAddress",
      weight: 7,
      done: hasText(provider?.address, 5),
    },
    {
      id: "tagline",
      labelKey: "provider.profileDocuments.strengthMissingTagline",
      weight: 6,
      done: hasText(provider?.tagline, 10),
    },
    {
      id: "bio",
      labelKey: "provider.profileDocuments.strengthMissingBio",
      weight: 10,
      done: hasText(provider?.bio, 50),
    },
    {
      id: "years",
      labelKey: "provider.profileDocuments.strengthMissingYears",
      weight: 5,
      done:
        provider?.yearsOfExperience !== null &&
        provider?.yearsOfExperience !== undefined &&
        Number.isFinite(Number(provider.yearsOfExperience)) &&
        Number(provider.yearsOfExperience) >= 0,
    },
    {
      id: "languages",
      labelKey: "provider.profileDocuments.strengthMissingLanguages",
      weight: 4,
      done:
        Array.isArray(provider?.languagesSpoken) &&
        provider.languagesSpoken.some((lang) => hasText(String(lang))),
    },
    {
      id: "gender",
      labelKey: "provider.profileDocuments.strengthMissingGender",
      weight: 2,
      done: provider?.gender === "FEMALE" || provider?.gender === "MALE",
    },
  ];

  for (const check of checks) {
    if (check.done) {
      score += check.weight;
    } else {
      missing.push({
        id: check.id,
        labelKey: check.labelKey,
        action: "edit-profile",
        weight: check.weight,
      });
    }
  }

  return { score: Math.min(score, PERSONAL_MAX), missing };
}

function computeSingleServiceScore(
  service: ProfileStrengthGivenService,
): { score: number; missing: ProfileStrengthMissingItem[] } {
  let score = 0;
  const missing: ProfileStrengthMissingItem[] = [];
  const serviceName = service.serviceName;
  const manageAction = {
    action: "manage-service" as const,
    serviceId: service.serviceId,
    serviceName,
  };

  const checks: Array<{
    id: string;
    labelKey: string;
    weight: number;
    done: boolean;
  }> = [
    {
      id: `service-photo-${service.serviceId}`,
      labelKey: "provider.profileDocuments.strengthMissingServicePhoto",
      weight: 15,
      done: hasText(service.servicePhoto),
    },
    {
      id: `service-description-${service.serviceId}`,
      labelKey: "provider.profileDocuments.strengthMissingServiceDescription",
      weight: 20,
      done: hasText(service.description, 40),
    },
    {
      id: `service-price-${service.serviceId}`,
      labelKey: "provider.profileDocuments.strengthMissingServicePrice",
      weight: 15,
      done:
        typeof service.price === "number" &&
        Number.isFinite(service.price) &&
        service.price > 0,
    },
    {
      id: `service-included-${service.serviceId}`,
      labelKey: "provider.profileDocuments.strengthMissingServiceIncluded",
      weight: 15,
      done: hasText(service.whatIsIncluded, 20),
    },
    {
      id: `service-gallery-${service.serviceId}`,
      labelKey: "provider.profileDocuments.strengthMissingServiceGallery",
      weight: 15,
      done: service.galleryCount >= 1,
    },
    {
      id: `service-coverage-${service.serviceId}`,
      labelKey: "provider.profileDocuments.strengthMissingServiceCoverage",
      weight: 10,
      done:
        (typeof service.estimatedDurationMinutes === "number" &&
          service.estimatedDurationMinutes > 0) ||
        (typeof service.minimumHours === "number" && service.minimumHours > 0) ||
        (typeof service.serviceRadiusKm === "number" &&
          service.serviceRadiusKm > 0) ||
        hasText(service.serviceAreaNotes, 10) ||
        hasText(service.clientMustProvide, 10),
    },
  ];

  for (const check of checks) {
    if (check.done) {
      score += check.weight;
    } else {
      missing.push({
        id: check.id,
        labelKey: check.labelKey,
        labelParams: { serviceName },
        weight: check.weight,
        ...manageAction,
      });
    }
  }

  return { score, missing };
}

function computeServicesScore(
  givenServices: ProfileStrengthGivenService[],
): { score: number; missing: ProfileStrengthMissingItem[] } {
  if (givenServices.length === 0) {
    return {
      score: 0,
      missing: [
        {
          id: "active-service",
          labelKey: "provider.profileDocuments.strengthMissingActiveService",
          action: "edit-profile",
          weight: SERVICES_MAX,
        },
      ],
    };
  }

  const perService = givenServices.map((service) =>
    computeSingleServiceScore(service),
  );
  const averageScore =
    perService.reduce((sum, item) => sum + item.score, 0) / perService.length;
  const scaledScore = (averageScore / 100) * SERVICES_MAX;

  const missing = perService
    .flatMap((item) => item.missing)
    .sort((a, b) => b.weight - a.weight);

  return { score: scaledScore, missing };
}

export function computeProviderProfileStrength(input: {
  profile: UserWithProfile | null | undefined;
  givenServices: ProfileStrengthGivenService[];
}): ProfileStrengthResult {
  const personal = computePersonalScore(input.profile);
  const services = computeServicesScore(input.givenServices);

  const rawTotal = personal.score + services.score;
  const percent = Math.min(100, Math.max(0, Math.round(rawTotal)));

  const missingItems = [...personal.missing, ...services.missing]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return {
    percent,
    missingItems,
    breakdown: {
      personal: Math.round(personal.score),
      services: Math.round(services.score),
    },
  };
}

export function extractActiveApprovedServicesFromDocuments(
  documents: Array<{
    verificationRequest?: {
      requestStatus?: string;
      service?: {
        id?: string;
        name?: string;
        isActiveForOwner?: boolean;
        servicePhoto?: string | null;
        description?: string | null;
      } | null;
    } | null;
  }>,
): Array<{
  id: string;
  name: string;
  servicePhoto?: string | null;
  description?: string | null;
}> {
  const seen = new Set<string>();
  const services: Array<{
    id: string;
    name: string;
    servicePhoto?: string | null;
    description?: string | null;
  }> = [];

  for (const doc of documents) {
    if (doc.verificationRequest?.requestStatus !== "APPROVED") continue;
    const service = doc.verificationRequest?.service;
    if (!service?.isActiveForOwner || !service.id) continue;
    const name = service.name?.trim();
    if (!name) continue;
    if (seen.has(service.id)) continue;
    seen.add(service.id);
    services.push({
      id: service.id,
      name,
      servicePhoto: service.servicePhoto ?? null,
      description: service.description ?? null,
    });
  }

  return services;
}
