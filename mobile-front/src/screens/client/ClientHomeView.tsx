import React, { useCallback, useState } from "react";
import { StatusBar, View, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ClientStackParamList } from "../../navigation/types";
import { useAuth } from "../../context/AuthContext";
import { Header } from "./home/Header";
import { ActiveOrderCard } from "./home/ActiveOrderCard";
import { PromotionalBanners } from "./home/PromotionalBanners";
import { ServiceCategories } from "./home/ServiceCategories";
import { RecommendedSection } from "./home/RecommendedSection";
import { PopularNearYou } from "./home/PopularNearYou";
import { styles } from "./home/styles";

export const ClientHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);
  const [categoriesRefreshSignal, setCategoriesRefreshSignal] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCategoriesRefreshSignal((prev) => prev + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 900);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Header
          avatarUri={user?.client?.imageUrl}
          city={user?.client?.city}
          address={user?.client?.address}
          onNotificationsPress={() =>
            navigation.navigate("ClientNotifications")
          }
        />
        <ScrollView
          style={styles.mainContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <ActiveOrderCard />
          <PromotionalBanners />
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
