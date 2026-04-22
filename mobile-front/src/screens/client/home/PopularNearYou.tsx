import React from "react";
import { View, Text, Image } from "react-native";
import { FontAwesome5 as Icon } from "@expo/vector-icons";
import { styles } from "./styles";

export const PopularNearYou: React.FC = () => (
  <View style={styles.popularContainer}>
    <Text style={styles.popularTitle}>Popular near Al Olaya</Text>
    <View style={styles.popularList}>
      <View style={styles.popularItem}>
        <Image
          source={{
            uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/f48cad009e-4f349cc0d9a71f14d364.png",
          }}
          style={styles.popularItemImage}
        />
        <View style={styles.popularItemContent}>
          <View style={styles.popularItemHeader}>
            <Text style={styles.popularItemTitle}>Brew Crew Coffee</Text>
            <Icon name="heart" size={12} color="#9ca3af" />
          </View>
          <View style={styles.popularItemInfo}>
            <Icon name="star" size={10} color="#facc15" solid />
            <Text style={styles.popularItemRating}>4.7</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.popularItemCategory}>Cafe</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.popularItemDistance}>1.2 km</Text>
          </View>
          <View style={styles.popularItemTags}>
            <View style={[styles.tag, { backgroundColor: "#eef2ff" }]}>
              <Text style={[styles.tagText, { color: "#4f46e5" }]}>Free Delivery</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: "#f3f4f6" }]}>
              <Text style={[styles.tagText, { color: "#4b5563" }]}>Top Rated</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.popularItem}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80",
          }}
          style={styles.popularItemImage}
        />
        <View style={styles.popularItemContent}>
          <View style={styles.popularItemHeader}>
            <Text style={styles.popularItemTitle}>QuickFix Plumbing</Text>
            <Icon name="heart" size={12} color="#9ca3af" />
          </View>
          <View style={styles.popularItemInfo}>
            <Icon name="star" size={10} color="#facc15" solid />
            <Text style={styles.popularItemRating}>4.9</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.popularItemCategory}>Maintenance</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.popularItemDistance}>0.8 km</Text>
          </View>
          <View style={styles.popularItemTags}>
            <View style={[styles.tag, { backgroundColor: "#f0fdf4" }]}>
              <Text style={[styles.tagText, { color: "#16a34a" }]}>Available Now</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  </View>
);
