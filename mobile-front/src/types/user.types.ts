// src/types/user.types.ts

export enum UserRole {
  CLIENT = "CLIENT",
  PROVIDER = "PROVIDER",
  COMPANY_ADMIN = "COMPANY_ADMIN",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
}

export enum AccountStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
  DELETED = "DELETED",
}

export enum ProviderType {
  INDEPENDENT = "INDEPENDENT",
  EMPLOYEE = "EMPLOYEE",
}

export interface User {
  id: string;
  email: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: AccountStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfile {
  id: string;
  city: string;
  address?: string;
  imageUrl?: string;
}

export interface ProviderProfile {
  id: string;
  type: ProviderType;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  averageRating: number;
  totalReviews: number;
  cancellationRate: number;
  isTopProvider: boolean;
  companyId?: string;
}

export interface CompanyProfile {
  id: string;
  legalName: string;
  commercialName: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  serviceZones: string[];
  mainContact: string;
  photoUrl?: string;
  averageRating: number;
  totalReviews: number;
}

export interface PlatformAdminProfile {
  id: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserWithProfile extends User {
  client?: ClientProfile;
  provider?: ProviderProfile;
  companyAdmin?: {
    id: string;
    companyId: string;
    company?: CompanyProfile;
  };
  platformAdmin?: PlatformAdminProfile;
}
