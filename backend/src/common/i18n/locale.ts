import { Locale } from '@prisma/client';

const FALLBACK_LOCALE = Locale.EN;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace('_', '-');
}

export function resolveLocale(
  langQuery?: string,
  acceptLanguageHeader?: string,
): Locale {
  const queryToken = langQuery ? normalizeToken(langQuery) : null;
  if (queryToken === 'ar') return Locale.AR;
  if (queryToken === 'en') return Locale.EN;

  const firstHeaderToken = acceptLanguageHeader
    ?.split(',')[0]
    ?.split(';')[0]
    ?.trim();
  if (!firstHeaderToken) return FALLBACK_LOCALE;

  const normalized = normalizeToken(firstHeaderToken);
  if (normalized === 'ar' || normalized.startsWith('ar-')) return Locale.AR;
  if (normalized === 'en' || normalized.startsWith('en-')) return Locale.EN;
  return FALLBACK_LOCALE;
}

export function localeFallbackChain(locale: Locale): Locale[] {
  return locale === FALLBACK_LOCALE
    ? [FALLBACK_LOCALE]
    : [locale, FALLBACK_LOCALE];
}
