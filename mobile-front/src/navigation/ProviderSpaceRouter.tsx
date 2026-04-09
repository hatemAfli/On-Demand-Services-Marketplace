import React from "react";
import { useAuth } from "../context/AuthContext";
import { AccountStatus, UserRole } from "../types";
import { ProviderOverlayNavigator } from "./ProviderOverlayNavigator";
import { ProviderBlockedScreen } from "../screens/provider/ProviderBlockedScreen";

/** ACTIVE providers get the full sidebar app; other statuses see a dedicated screen. */
export const ProviderSpaceRouter: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.PROVIDER) {
    return null;
  }

  if (user.status === AccountStatus.ACTIVE) {
    return <ProviderOverlayNavigator />;
  }

  return <ProviderBlockedScreen />;
};
