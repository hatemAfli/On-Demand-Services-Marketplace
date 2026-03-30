// src/navigation/AuthNavigator.tsx

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { WelcomeScreen } from "../screens/auth/WelcomeScreen";
import {
  LoginScreen,
  SignUpScreen,
  TermsScreen,
  PrivacyScreen,
  EmailVerificationScreen,
  OTPVerificationScreen,
  CompleteProfileRouter,
} from "../screens/auth";
import { COLORS } from "../constants";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

type Props = {
  initialRouteName?: keyof AuthStackParamList;
  completeProfileInitialParams?: AuthStackParamList["CompleteProfile"];
};

export const AuthNavigator: React.FC<Props> = ({
  initialRouteName = "Welcome",
  completeProfileInitialParams,
}) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
      />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <Stack.Screen
        name="CompleteProfile"
        component={CompleteProfileRouter}
        initialParams={completeProfileInitialParams}
      />
    </Stack.Navigator>
  );
};
