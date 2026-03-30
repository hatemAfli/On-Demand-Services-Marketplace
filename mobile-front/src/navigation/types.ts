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
