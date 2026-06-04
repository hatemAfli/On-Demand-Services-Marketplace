import { Locale, Prisma } from '@prisma/client';

export const CLIENT_REVIEW_LIST_INCLUDE = {
  provider: {
    select: {
      photoUrl: true,
      user: {
        select: { firstName: true, lastName: true },
      },
    },
  },
  givenService: {
    include: {
      service: {
        include: {
          translations: true,
        },
      },
    },
  },
  appointment: {
    select: {
      scheduledDate: true,
      scheduledTime: true,
    },
  },
} satisfies Prisma.ReviewInclude;

export type ClientReviewRow = Prisma.ReviewGetPayload<{
  include: typeof CLIENT_REVIEW_LIST_INCLUDE;
}>;

function pickTranslationName(
  translations: { locale: Locale; name: string }[],
  preferAr: boolean,
): string {
  if (!translations.length) return '';
  const loc = preferAr ? Locale.AR : Locale.EN;
  return (
    translations.find((t) => t.locale === loc)?.name ??
    translations.find((t) => t.locale === Locale.EN)?.name ??
    translations[0]?.name ??
    ''
  );
}

export function mapClientReviewItem(
  row: ClientReviewRow,
  locale: 'en' | 'ar' = 'en',
) {
  const preferAr = locale === 'ar';
  const providerName =
    `${row.provider.user.firstName ?? ''} ${row.provider.user.lastName ?? ''}`.trim() ||
    'Provider';
  const serviceName = pickTranslationName(
    row.givenService.service.translations,
    preferAr,
  );

  return {
    id: row.id,
    appointmentId: row.appointmentId,
    providerId: row.providerId,
    givenServiceId: row.givenServiceId,
    rating: row.rating,
    comment: row.comment?.trim() || null,
    providerReply: row.providerReply?.trim() || null,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    providerName,
    providerPhotoUrl: row.provider.photoUrl ?? null,
    serviceName: serviceName || 'Service',
    scheduledDate: row.appointment.scheduledDate.toISOString().slice(0, 10),
    scheduledTime: row.appointment.scheduledTime,
  };
}
