import { ProviderType, type UserWithProfile } from "../types";

export function isEmployeeProvider(
  user: UserWithProfile | null | undefined,
): boolean {
  return user?.provider?.type === ProviderType.EMPLOYEE;
}

/** Employee providers only see jobs once the company has confirmed them. */
export function isAppointmentVisibleToEmployeeProvider(status: string): boolean {
  return status !== "PENDING";
}
