import { UserRole } from "../types";

export type AuthStackParamList = {
  Welcome: undefined;
  Terms: undefined;
  Privacy: undefined;
  Login: undefined;
  SignUp: undefined;
  EmailVerification: { email: string; role: UserRole };
  OTPVerification: { phone: string; role: UserRole };
  CompleteProfile: { role: UserRole };
};

export type ClientStackParamList = {
  ClientHome: undefined;
  /** Marketplace services listed under one category (from home grid). */
  ClientCategoryServices: { categoryId: string; categoryName: string };
  ClientSearchProvider: undefined;
  ClientMessages: undefined;
  ClientReclamation: undefined;
  ClientReservation: undefined;
  ClientFavorites: undefined;
  ClientNotifications: undefined;
  ClientProfile: undefined;
  ClientSettings: undefined;
};

export type ProviderStackParamList = {
  ProviderHome: undefined;
  ProviderDashboard: undefined;
  ProviderServices: undefined;
  ProviderMessages: undefined;
  ProviderNotifications: undefined;
  ProviderReclamations: undefined;
  ProviderOrders: undefined;
  ProviderSchedule: undefined;
  ProviderGallery: undefined;
  ProviderRatings: undefined;
  ProviderProfile: undefined;
  ProviderSettings: undefined;
};
