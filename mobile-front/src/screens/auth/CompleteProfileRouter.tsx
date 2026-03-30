// src/screens/auth/CompleteProfileRouter.tsx

import React from "react";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { UserRole } from "../../types";
import { CompleteProfileClientScreen } from "./CompleteProfileClientScreen";
import { CompleteProfileProviderScreen } from "./CompleteProfileProviderScreen";
import { CompleteProfileCompanyScreen } from "./CompleteProfileCompanyScreen";

interface CompleteProfileRouterProps {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ CompleteProfile: { role: UserRole } }, "CompleteProfile">;
}

export const CompleteProfileRouter: React.FC<CompleteProfileRouterProps> = ({
  navigation,
  route,
}) => {
  const role = route.params?.role ?? UserRole.CLIENT;

  switch (role) {
    case UserRole.CLIENT:
      return <CompleteProfileClientScreen navigation={navigation} />;
    case UserRole.PROVIDER:
      return <CompleteProfileProviderScreen navigation={navigation} />;
    case UserRole.COMPANY_ADMIN:
      return <CompleteProfileCompanyScreen navigation={navigation} />;
    default:
      return <CompleteProfileClientScreen navigation={navigation} />;
  }
};
