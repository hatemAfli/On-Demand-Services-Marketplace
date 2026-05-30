import { UserRole } from "../types";
import type { NotificationType } from "../services/api";

/** Params for in-app notification detail (account / document messages). */
export type NotificationDetailParams = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  data: Record<string, unknown> | null;
};

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
  ClientHomeSearch: undefined;
  /** Marketplace services listed under one category (from home grid). */
  ClientCategoryServices: { categoryId: string; categoryName: string };
  ClientSearchProvider:
    | {
        serviceId: string;
        serviceName: string;
        serviceImage?: string;
        clientLat?: number;
        clientLng?: number;
      }
    | undefined;
  ClientProviderProfile: { givenServiceId: string };
  /** Read-only provider reviews (marketplace / client). */
  PublicProviderReviews: {
    providerId: string;
    providerName: string;
    isTopProvider?: boolean;
  };
  ClientSlotPicker: {
    providerId: string;
    givenServiceId: string;
    providerName: string;
    serviceName: string;
    estimatedDurationMinutes: number;
  };
  ClientBookingConfirmation: {
    appointmentId: string;
    providerName: string;
    serviceName: string;
    scheduledDate: string;
    scheduledTime: string;
  };
  ClientMessages: undefined;
  ConversationList: undefined;
  ChatScreen: {
    conversationId: string;
    otherUserName: string;
    otherUserPhoto: string | null;
  };
  /** Client bookings / appointments list (preferred name for new flows). */
  ClientAppointments: undefined;
  ClientAppointmentDetail: { appointmentId: string };
  ClientLeaveReview: {
    appointmentId: string;
    providerName: string;
    serviceName: string;
    providerPhoto: string | null;
  };
  ClientFileComplaint: {
    appointmentId: string;
    providerName: string;
    serviceName: string;
  };
  ClientComplaintSuccess: {
    category: string;
    providerName: string;
  };
  /** Client's filed complaints (from GET /complaints/me). */
  ClientMyComplaints: undefined;
  ClientComplaintDetail: { complaintId: string };
  ClientFavorites: undefined;
  ClientFavoritesList: { type: "CATEGORY" | "SERVICE" | "PROVIDER" };
  Notifications: undefined;
  NotificationDetail: NotificationDetailParams;
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
  | "ClientCategoryServices"
  | "ClientSearchProvider"
  | "ClientProviderProfile"
  | "PublicProviderReviews"
  | "ClientSlotPicker"
  | "ClientBookingConfirmation"
  | "ClientAppointmentDetail"
  | "ClientLeaveReview"
  | "ClientFileComplaint"
  | "ClientComplaintSuccess"
  | "ClientComplaintDetail"
  | "ClientHomeSearch"
  | "ClientFavoritesList"
  | "NotificationDetail"
  | "ChatScreen"
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
  ProviderRequestService: undefined;
  ProviderVerificationRequestDetail: {
    request: {
      id: string;
      requestStatus: string;
      adminComment?: string | null;
      createdAt: string;
      service?: {
        id: string;
        name: string;
        description?: string | null;
        servicePhoto?: string | null;
        photoUrl?: string | null;
        imageUrl?: string | null;
        category?: { name: string } | null;
      } | null;
      documents?: Array<{
        id: string;
        type: string;
        fichierUrl: string;
        uploadedAt: string;
        validatedAt?: string | null;
        isAccepted?: boolean | null;
        rejectionReason?: string | null;
      }>;
    };
  };
  ProviderMessages: undefined;
  ConversationList: undefined;
  ChatScreen: {
    conversationId: string;
    otherUserName: string;
    otherUserPhoto: string | null;
  };
  Notifications: undefined;
  NotificationDetail: NotificationDetailParams;
  ProviderComplaints: undefined;
  ProviderSchedule: undefined;
  ProviderDaysOff: undefined;
  ProviderCalendar: undefined;
  ProviderAppointmentDetail: { appointmentId: string };
  ProviderItinerary: {
    clientLat: number;
    clientLng: number;
    clientName: string;
  };
  ProviderInvitations: undefined;
  ProviderSubscriptionPlan: undefined;
  ProviderRatings: undefined;
  /** Paginated public reviews for the signed-in provider (own id from profile). */
  ProviderReviews: undefined;
  ProviderProfile: undefined;
  ProviderEditProfile: undefined;
  ProviderDocumentDetails: {
    document: {
      id: string;
      type: string;
      fichierUrl: string;
      uploadedAt: string;
      validatedAt: string | null;
      isAccepted?: boolean | null;
      rejectionReason?: string | null;
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
