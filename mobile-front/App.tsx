// App.tsx

import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AppLaunchOverlay } from "./src/components/common/AppLaunchOverlay";
import "./src/i18n";

const SPLASH_MS = 3000;

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setShowSplash(false), SPLASH_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={styles.root}>
          <AppNavigator />
          {showSplash && <AppLaunchOverlay />}
        </View>
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
