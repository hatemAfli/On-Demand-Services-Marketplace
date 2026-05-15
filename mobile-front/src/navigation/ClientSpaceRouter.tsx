import React from "react";
import { useAuth } from "../context/AuthContext";
import { AccountStatus, UserRole } from "../types";
import { ClientOverlayNavigator } from "./ClientOverlayNavigator";
import { ClientBlockedScreen } from "../screens/client/blocked_screen/ClientBlockedScreen";

/** ACTIVE clients get the full app; suspended/deleted (and other non-active) see a dedicated screen. */
export const ClientSpaceRouter: React.FC = () => {
  const { user } = useAuth();

  if (!user || user.role !== UserRole.CLIENT) {
    return null;
  }

  if (user.status === AccountStatus.ACTIVE) {
    return <ClientOverlayNavigator />;
  }

  return <ClientBlockedScreen />;
};
