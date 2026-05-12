import React, { useCallback, useMemo, useState } from "react";
import { StatusBar, View, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "../../../navigation/types";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../services/api";
import { Header } from "./Header";
import { ActiveOrderCard } from "./ActiveOrderCard";
import { ServiceCategories } from "./ServiceCategories";
import { RecommendedSection } from "./RecommendedSection";
import { PopularNearYou } from "./PopularNearYou";
import { styles } from "./styles";

export const ClientHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [categoriesRefreshSignal, setCategoriesRefreshSignal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          const res = await api.getUnreadCount();
          if (!cancelled) setUnreadCount(res.data?.count ?? 0);
        } catch {
          if (!cancelled) setUnreadCount(0);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCategoriesRefreshSignal((prev) => prev + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 900);
  }, []);

  const clientDisplayName = useMemo(
    () =>
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "",
    [user?.firstName, user?.lastName],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Header
          avatarUri={user?.client?.imageUrl}
          clientName={clientDisplayName}
          city={user?.client?.city}
          address={user?.client?.address}
          onSearchPress={() => navigation.navigate("ClientHomeSearch")}
          onProfilePress={() => navigation.navigate("ClientSettings")}
          unreadNotificationCount={unreadCount}
          onNotificationsPress={() => navigation.navigate("Notifications")}
        />
        <ScrollView
          style={styles.mainContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <ActiveOrderCard
            refreshSignal={categoriesRefreshSignal}
            onOpenAppointment={(appointmentId) =>
              navigation.navigate("ClientAppointmentDetail", { appointmentId })
            }
          />
          <ServiceCategories refreshSignal={categoriesRefreshSignal} />
          <RecommendedSection />
          <PopularNearYou
            city={user?.client?.city}
            address={user?.client?.address}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
