export type AdminValidationsStackParamList = {
  ValidationsHome: undefined;
  ValidationProviderDetail: {
    /** Single verification submission (one admin decision for all attached documents). */
    requestId: string;
    displayName?: string;
    email?: string;
  };
};
