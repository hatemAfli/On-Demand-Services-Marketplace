import React from "react";
import { useAuth } from "../context/AuthContext";
import { AccountStatus, UserRole } from "../types";
import { CompanyDashboardScreen } from "../screens/company/CompanyDashboardScreen";
import { CompanyBlockedScreen } from "../screens/company/CompanyBlockedScreen";

/** ACTIVE company admins get the dashboard; other statuses see pending/rejection UI. */
export const CompanySpaceRouter: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.COMPANY_ADMIN) {
    return null;
  }

  if (user.status === AccountStatus.ACTIVE) {
    return <CompanyDashboardScreen />;
  }

  return <CompanyBlockedScreen />;
};
