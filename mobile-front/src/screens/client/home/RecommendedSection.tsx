import React from "react";
import { View, Text, Image, ScrollView, TouchableOpacity } from "react-native";
import { FontAwesome5 as Icon } from "@expo/vector-icons";
import { styles } from "./styles";

export const RecommendedSection: React.FC = () => (
  <View style={styles.recommendedContainer}>
    <View style={styles.recommendedHeader}>
      <View>
        <Text style={styles.recommendedTitle}>Recommended for you</Text>
        <Text style={styles.recommendedSubtitle}>Based on your recent activity</Text>
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendedScrollView}>
      <View style={styles.recommendedCard}>
        <View style={styles.cardImageContainer}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80",
            }}
            style={styles.cardImage}
          />
          <View style={styles.cardInfoBadge}>
            <Icon name="clock" size={10} color="#4F46E5" solid />
            <Text style={styles.cardInfoBadgeText}>25-35 min</Text>
          </View>
          <TouchableOpacity style={styles.favoriteButton}>
            <Icon name="heart" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.cardTextContainer}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Burger Boutique</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={10} color="#16a34a" solid />
              <Text style={styles.ratingText}>4.8</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>American • Burgers • Fast Food</Text>
          <View style={styles.cardFooter}>
            <View style={styles.footerInfo}>
              <Icon name="motorcycle" size={12} color="#d1d5db" />
              <Text style={styles.footerText}>SAR 15</Text>
            </View>
            <View style={styles.footerInfo}>
              <Icon name="tag" size={12} color="#6366f1" />
              <Text style={[styles.footerText, { color: "#4f46e5", fontWeight: "bold" }]}>
                Free Delivery
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.recommendedCard}>
        <View style={styles.cardImageContainer}>
          <Image
            source={{
              uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/8d62fd9938-818ce434ad4177cfc36d.png",
            }}
            style={styles.cardImage}
          />
          <View style={styles.cardInfoBadge}>
            <Icon name="bolt" size={10} color="#f59e0b" />
            <Text style={styles.cardInfoBadgeText}>Instant</Text>
          </View>
          <TouchableOpacity style={styles.favoriteButton}>
            <Icon name="heart" size={12} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.cardTextContainer}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>ProClean Services</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={10} color="#16a34a" solid />
              <Text style={styles.ratingText}>4.9</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>Home Cleaning • Deep Clean</Text>
          <View style={styles.cardFooter}>
            <View style={styles.footerInfo}>
              <Icon name="money-bill-wave" size={12} color="#d1d5db" />
              <Text style={styles.footerText}>From SAR 80/hr</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  </View>
);
