import {
  AccountStatus,
  OwnerType,
  PricingType,
  PrismaClient,
  ProviderGender,
  ProviderType,
  UserRole,
} from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const TOTAL_PROVIDERS = 1000;
const DEFAULT_PASSWORD = 'Test123456!';
const EMAIL_PREFIX = 'provider';
const EMAIL_DOMAIN = 'gmail.com';

const TUNISIAN_CITIES = [
  { city: 'Tunis', lat: 36.8065, lng: 10.1815 },
  { city: 'Sfax', lat: 34.7406, lng: 10.7603 },
  { city: 'Sousse', lat: 35.8256, lng: 10.6084 },
  { city: 'Kairouan', lat: 35.6781, lng: 10.0963 },
  { city: 'Bizerte', lat: 37.2746, lng: 9.8739 },
  { city: 'Gabes', lat: 33.8815, lng: 10.0982 },
  { city: 'Ariana', lat: 36.8663, lng: 10.1647 },
  { city: 'Gafsa', lat: 34.425, lng: 8.7842 },
  { city: 'Monastir', lat: 35.7643, lng: 10.8113 },
  { city: 'Ben Arous', lat: 36.7531, lng: 10.2189 },
  { city: 'Nabeul', lat: 36.4561, lng: 10.7376 },
  { city: 'Mahdia', lat: 35.5047, lng: 11.0622 },
] as const;

const TAGLINES = [
  'Fast and reliable home service',
  'Experienced specialist near you',
  'Quality work with fair pricing',
  'Trusted provider for urgent tasks',
  'Professional service with clear communication',
];

const BIOS = [
  'I provide clean, reliable work and always respect appointments.',
  'I focus on quality details and customer satisfaction in every visit.',
  'I have strong field experience and use practical solutions on-site.',
  'I respond quickly and explain the work clearly before starting.',
  'I deliver safe, professional service with transparent pricing.',
];

const PROVIDER_PAYMENT_METHODS = [
  ['Cash'],
  ['Cash', 'Bank Transfer'],
  ['Cash', 'Card'],
  ['Cash', 'Mobile Payment'],
] as const;

const INCLUDED_TEXTS = [
  'Basic labor, standard tools, and work area cleanup.',
  'On-site diagnosis, execution, and final quality check.',
  'Travel inside covered area and standard installation materials.',
  'Service execution with standard consumables and safety checks.',
];

const NOT_INCLUDED_TEXTS = [
  'Custom premium materials are not included.',
  'Major structural modifications are excluded.',
  'Replacement parts beyond standard consumables are excluded.',
  'Additional tasks outside agreed scope are excluded.',
];

const CLIENT_MUST_PROVIDE_TEXTS = [
  'Access to the work area and electricity/water when required.',
  'Permission to access building/common areas during appointment.',
  'Any custom part requested by the client before intervention.',
  'Clear instructions and on-site contact availability.',
];

const DESCRIPTION_TEXTS = [
  'Professional service delivered with attention to detail and safety.',
  'Efficient intervention adapted to the client needs and schedule.',
  'Reliable on-site support with practical and transparent execution.',
  'Quality-focused service with clear communication and follow-up.',
];

const SERVICE_AREA_NOTES = [
  'Mainly urban zones, with flexible scheduling for nearby suburbs.',
  'Coverage includes city center and surrounding neighborhoods.',
  'Available in covered areas with possibility of urgent visits.',
  'Service available during weekdays and weekends depending on demand.',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function randomBool(): boolean {
  return Math.random() >= 0.5;
}

function randomFrom<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function providerEmail(index: number): string {
  return `${EMAIL_PREFIX}${index}@${EMAIL_DOMAIN}`;
}

async function loadExistingProviderAuthUsers(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Map<string, string>> {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const out = new Map<string, string>();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const users = data?.users ?? [];
    for (const user of users) {
      const email = user.email?.toLowerCase().trim();
      if (!email) continue;
      if (/^provider\d+@gmail\.com$/i.test(email)) {
        out.set(email, user.id);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return out;
}

async function getOrCreateAuthUserId(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
  existingMap: Map<string, string>,
): Promise<string> {
  const existing = existingMap.get(email);
  if (existing) return existing;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      selected_role: UserRole.PROVIDER,
      profile_completed: true,
    },
  });

  if (error || !data.user?.id) {
    throw error ?? new Error(`Failed to create auth user for ${email}`);
  }

  existingMap.set(email, data.user.id);
  return data.user.id;
}

async function seedProviders() {
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const services = await prisma.service.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (services.length === 0) {
    throw new Error(
      'No active services found. Seed services first before provider seeding.',
    );
  }

  const existingAuthUsers = await loadExistingProviderAuthUsers(
    supabaseUrl,
    serviceRoleKey,
  );

  let createdOrUpdated = 0;

  for (let i = 1; i <= TOTAL_PROVIDERS; i += 1) {
    const email = providerEmail(i);
    const userId = await getOrCreateAuthUserId(
      supabaseUrl,
      serviceRoleKey,
      email,
      existingAuthUsers,
    );
    const serviceId = services[(i - 1) % services.length].id;
    const cityData = TUNISIAN_CITIES[(i - 1) % TUNISIAN_CITIES.length];
    const latitude = Number(
      (cityData.lat + randomFloat(-0.02, 0.02, 5)).toFixed(6),
    );
    const longitude = Number(
      (cityData.lng + randomFloat(-0.02, 0.02, 5)).toFixed(6),
    );
    const totalReviews = randomInt(0, 300);
    const totalCompletedJobs = randomInt(0, 1200);
    const averageRating = totalReviews === 0 ? null : randomFloat(3.2, 5, 2);
    const yearsOfExperience = randomInt(1, 20);
    const cancellationRate = randomFloat(0, 12, 2);
    const averageResponseTime = randomFloat(5, 240, 2);
    const paymentMethodsAccepted = [...randomFrom(PROVIDER_PAYMENT_METHODS)];
    const pricingType = randomBool() ? PricingType.FIXED : PricingType.HOURLY;
    const price =
      pricingType === PricingType.FIXED
        ? randomFloat(40, 400, 2)
        : randomFloat(10, 80, 2);

    await prisma.$transaction(async (tx) => {
      const byEmail = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (byEmail && byEmail.id !== userId) {
        throw new Error(
          `Email ${email} already linked to a different users.id (${byEmail.id})`,
        );
      }

      await tx.user.upsert({
        where: { id: userId },
        update: {
          email,
          firstName: `Provider${i}`,
          lastName: 'Demo',
          role: UserRole.PROVIDER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
        },
        create: {
          id: userId,
          email,
          firstName: `Provider${i}`,
          lastName: 'Demo',
          role: UserRole.PROVIDER,
          status: AccountStatus.ACTIVE,
          isEmailVerified: true,
        },
      });

      await tx.provider.upsert({
        where: { id: userId },
        update: {
          type: ProviderType.INDEPENDENT,
          city: cityData.city,
          address: `${randomInt(1, 120)} Rue ${cityData.city}`,
          latitude,
          longitude,
          photoUrl: null,
          totalReviews,
          cancellationRate,
          averageResponseTime,
          isTopProvider: randomBool(),
          tagline: randomFrom(TAGLINES),
          bio: randomFrom(BIOS),
          yearsOfExperience,
          gender: randomBool() ? ProviderGender.MALE : ProviderGender.FEMALE,
          languagesSpoken: [
            'Arabic',
            ...(randomBool() ? ['French'] : []),
            ...(randomBool() ? ['English'] : []),
          ],
          paymentMethodsAccepted,
        },
        create: {
          id: userId,
          type: ProviderType.INDEPENDENT,
          city: cityData.city,
          address: `${randomInt(1, 120)} Rue ${cityData.city}`,
          latitude,
          longitude,
          photoUrl: null,
          totalReviews,
          cancellationRate,
          averageResponseTime,
          isTopProvider: randomBool(),
          tagline: randomFrom(TAGLINES),
          bio: randomFrom(BIOS),
          yearsOfExperience,
          gender: randomBool() ? ProviderGender.MALE : ProviderGender.FEMALE,
          languagesSpoken: [
            'Arabic',
            ...(randomBool() ? ['French'] : []),
            ...(randomBool() ? ['English'] : []),
          ],
          paymentMethodsAccepted,
        },
      });

      const existingGiven = await tx.givenService.findFirst({
        where: {
          ownerType: OwnerType.PROVIDER,
          ownerId: userId,
          serviceId,
        },
        select: { id: true },
      });

      if (existingGiven) {
        await tx.givenService.update({
          where: { id: existingGiven.id },
          data: {
            pricingType,
            price,
            minimumHours:
              pricingType === PricingType.HOURLY ? randomInt(1, 6) : null,
            estimatedDurationMinutes: randomInt(30, 300),
            description: randomFrom(DESCRIPTION_TEXTS),
            whatIsIncluded: randomFrom(INCLUDED_TEXTS),
            whatIsNotIncluded: randomFrom(NOT_INCLUDED_TEXTS),
            toolsProvidedByProvider: randomBool(),
            serviceAreaNotes: randomFrom(SERVICE_AREA_NOTES),
            advanceBookingRequiredHours: randomInt(0, 72),
            serviceRadiusKm: randomFloat(2, 35, 1),
            isAvailableImmediately: randomBool(),
            averageRating,
            totalReviews,
            totalCompletedJobs,
            clientMustProvide: randomFrom(CLIENT_MUST_PROVIDE_TEXTS),
            ownerType: OwnerType.PROVIDER,
            ownerId: userId,
            active: true,
          },
        });
      } else {
        await tx.givenService.create({
          data: {
            serviceId,
            pricingType,
            price,
            minimumHours:
              pricingType === PricingType.HOURLY ? randomInt(1, 6) : null,
            estimatedDurationMinutes: randomInt(30, 300),
            description: randomFrom(DESCRIPTION_TEXTS),
            whatIsIncluded: randomFrom(INCLUDED_TEXTS),
            whatIsNotIncluded: randomFrom(NOT_INCLUDED_TEXTS),
            toolsProvidedByProvider: randomBool(),
            serviceAreaNotes: randomFrom(SERVICE_AREA_NOTES),
            advanceBookingRequiredHours: randomInt(0, 72),
            serviceRadiusKm: randomFloat(2, 35, 1),
            isAvailableImmediately: randomBool(),
            averageRating,
            totalReviews,
            totalCompletedJobs,
            clientMustProvide: randomFrom(CLIENT_MUST_PROVIDE_TEXTS),
            ownerType: OwnerType.PROVIDER,
            ownerId: userId,
            active: true,
          },
        });
      }
    });

    createdOrUpdated += 1;
    if (i % 100 === 0) {
      console.log(`Seed progress: ${i}/${TOTAL_PROVIDERS}`);
    }
  }

  console.log(
    `Provider seed complete. Created/updated ${createdOrUpdated} providers across ${services.length} services.`,
  );
}

seedProviders()
  .catch((error) => {
    console.error('Provider seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
