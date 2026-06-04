export interface OwnerSnapshot {
  id: string;
  type: 'PROVIDER' | 'COMPANY';
  displayName: string;
  photoUrl: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  averageRating: number;
  totalReviews: number;
  isTopProvider: boolean;
  yearsOfExperience: number | null;
  tagline: string | null;
  cancellationRate: number;
  averageResponseTime: number | null;
  gender: string | null;
  languagesSpoken: string[];
  paymentMethodsAccepted: string[];
}

export interface GalleryPreview {
  id: string;
  imageUrl: string;
}

export interface SearchResultItem {
  givenServiceId: string;
  createdAt: Date;
  serviceId: string;
  serviceName: string;
  categoryName: string;
  pricingType: string;
  price: number;
  minimumHours: number | null;
  estimatedDurationMinutes: number | null;
  description: string | null;
  whatIsIncluded: string | null;
  whatIsNotIncluded: string | null;
  toolsProvidedByProvider: boolean | null;
  isAvailableImmediately: boolean | null;
  averageRating: number;
  totalReviews: number;
  totalCompletedJobs: number;
  serviceRadiusKm: number | null;
  galleries: GalleryPreview[];
  owner: OwnerSnapshot;
  /** For COMPANY entries: how many of the company's providers offer this service. */
  providerCount?: number;
  _score: number;
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
