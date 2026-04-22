import React from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { styles } from "./styles";

export const PromotionalBanners: React.FC = () => (
  <View style={styles.bannersContainer}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bannersScrollView}>
      <View style={[styles.banner, styles.banner1]}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1556910103-1c02745a30bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
          }}
          style={styles.bannerImage}
        />
        <View style={styles.bannerOverlay} />
        <View style={styles.bannerTextContainer}>
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>PROMO</Text>
          </View>
          <Text style={styles.bannerTitle}>50% OFF Cleaning</Text>
          <Text style={styles.bannerSubtitle}>Get your home sparkling clean today!</Text>
        </View>
      </View>
      <View style={[styles.banner, styles.banner2]}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
          }}
          style={styles.bannerImage}
        />
        <View style={styles.bannerOverlay} />
        <View style={styles.bannerTextContainer}>
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>FREE DELIVERY</Text>
          </View>
          <Text style={styles.bannerTitle}>Burger Festival</Text>
          <Text style={styles.bannerSubtitle}>Order from top burger joints now.</Text>
        </View>
      </View>
    </ScrollView>
  </View>
);
