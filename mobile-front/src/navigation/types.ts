import { UserRole } from "../types";

export type AuthStackParamList = {
  Welcome: undefined;
  Terms: undefined;
  Privacy: undefined;
  Login: undefined;
  ForgotPassword: undefined;
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
  ClientSettings: undefined;
  ClientEditProfile: undefined;
  ClientChangeEmail: undefined;
  ClientChangePhone: undefined;
  ClientChangePassword: undefined;
  ClientSavedAddresses: undefined;
  ClientDeleteAccount: undefined;
  ClientTerms: undefined;
  ClientPrivacy: undefined;
};

/** Client stack screens that do not require params (e.g. drawer / root shortcuts). */
export type ClientStackRouteWithoutParams = Exclude<
  keyof ClientStackParamList,
  "ClientCategoryServices"
>;

export type ProviderStackParamList = {
  ProviderHome: undefined;
  ProviderDashboard: undefined;
  ProviderServices: undefined;
  ProviderManageService: {
    mode: "create" | "edit";
    serviceId?: string;
    serviceName?: string;
    serviceCategory?: string;
    serviceDescription?: string;
  };
  ProviderMessages: undefined;
  ProviderNotifications: undefined;
  ProviderReclamations: undefined;
  ProviderOrders: undefined;
  ProviderSchedule: undefined;
  ProviderSubscriptionPlan: undefined;
  ProviderRatings: undefined;
  ProviderProfile: undefined;
  ProviderEditProfile: undefined;
  ProviderDocumentDetails: {
    document: {
      id: string;
      type: string;
      fichierUrl: string;
      uploadedAt: string;
      validatedAt: string | null;
      verificationRequest: {
        id: string;
        requestStatus: string;
        ownerType?: string | null;
        createdAt: string;
        updatedAt?: string;
        adminComment?: string | null;
        ownerComment?: string | null;
        serviceId?: string | null;
        service?: {
          id: string;
          servicePhoto?: string | null;
          name: string;
          category?: {
            slug: string;
            name: string;
            iconUrl?: string | null;
          } | null;
        } | null;
      } | null;
    };
  };
  ProviderSettings: undefined;
  ProviderChangeEmail: undefined;
  ProviderChangePhone: undefined;
  ProviderChangePassword: undefined;
  ProviderDeleteAccount: undefined;
  ProviderTerms: undefined;
  ProviderPrivacy: undefined;
};
