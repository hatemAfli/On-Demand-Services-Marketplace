import React, { useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import {
  ServiceDiscoveryCard,
  type ServiceCardDisplay,
} from "../category-services/ListOfServicesScreen";
import { styles } from "./styles";

type RecommendedSeed = {
  id: string;
  imageUri: string;
  title: string;
  description: string;
  duration: string;
  activeGivenCount: number;
};

/** Placeholder catalog-style rows; three picked at random per mount until recommendations API exists. */
const RECOMMENDED_POOL: RecommendedSeed[] = [
  {
    id: "1",
    imageUri:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
    title: "Sparkle Home Clean",
    description: "Home • Deep cleaning • Weekly slots",
    duration: "25–35 min",
    activeGivenCount: 14,
  },
  {
    id: "2",
    imageUri:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80",
    title: "ProFix Electrical",
    description: "Electrical • Wiring • Safety checks",
    duration: "Same day",
    activeGivenCount: 9,
  },
  {
    id: "3",
    imageUri:
      "https://images.unsplash.com/photo-1631540579695-8c0dacdbe22b?auto=format&fit=crop&w=800&q=80",
    title: "CoolAir HVAC",
    description: "AC • Maintenance • Gas refill",
    duration: "45–60 min",
    activeGivenCount: 11,
  },
  {
    id: "4",
    imageUri:
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80",
    title: "PipeRight Plumbing",
    description: "Plumbing • Leaks • Installations",
    duration: "Emergency",
    activeGivenCount: 7,
  },
  {
    id: "5",
    imageUri:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
    title: "GreenGarden Care",
    description: "Landscaping • Irrigation • Seasonal trim",
    duration: "1–2 hrs",
    activeGivenCount: 6,
  },
  {
    id: "6",
    imageUri:
      "https://images.unsplash.com/photo-1563453392212-326f5e854d02?auto=format&fit=crop&w=800&q=80",
    title: "SmartLock Security",
    description: "Locks • Smart doors • Key copy",
    duration: "30 min",
    activeGivenCount: 8,
  },
  {
    id: "7",
    imageUri:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80",
    title: "BuildCraft Carpentry",
    description: "Woodwork • Shelves • Repairs",
    duration: "Book ahead",
    activeGivenCount: 5,
  },
  {
    id: "8",
    imageUri:
      "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=800&q=80",
    title: "ChefAtHome Catering",
    description: "Private chef • Events • Meal prep",
    duration: "2–3 hrs",
    activeGivenCount: 4,
  },
  {
    id: "9",
    imageUri:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80",
    title: "PaintPro Interiors",
    description: "Painting • Prep • Color consult",
    duration: "Half day",
    activeGivenCount: 10,
  },
  {
    id: "10",
    imageUri:
      "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?auto=format&fit=crop&w=800&q=80",
    title: "MoveEasy Helpers",
    description: "Moving • Packing • Furniture",
    duration: "Weekend slots",
    activeGivenCount: 12,
  },
];

function pickRandomThree(services: RecommendedSeed[]): RecommendedSeed[] {
  const shuffled = [...services];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = t!;
  }
  return shuffled.slice(0, 3);
}

function toCardDisplay(
  item: RecommendedSeed,
  t: (key: string, opts?: Record<string, unknown>) => string,
): ServiceCardDisplay {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    duration: item.duration,
    price: t("client.categoryServices.priceOnRequest"),
    unit: "",
    image: item.imageUri,
    activeGivenCount: item.activeGivenCount,
  };
}

export const RecommendedSection: React.FC = () => {
  const { t } = useAppTranslation();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(320, width - 48);
  const [items] = useState(() => pickRandomThree(RECOMMENDED_POOL));

  return (
    <View style={styles.recommendedContainer}>
      <View style={styles.recommendedHeader}>
        <View>
          <Text style={styles.recommendedTitle}>Recommended for you</Text>
          <Text style={styles.recommendedSubtitle}>
            Based on your recent activity
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.recommendedScrollView}
        contentContainerStyle={{ paddingRight: 24 }}
      >
        {items.map((item) => {
          const card = toCardDisplay(item, t);
          return (
            <ServiceDiscoveryCard
              key={item.id}
              style={{ width: cardWidth, marginRight: 16 }}
              service={card}
              isFavorite={false}
              onToggleFavorite={() => {}}
              providersCountLabel={t("client.categoryServices.cardProvidersCount", {
                count: card.activeGivenCount,
              })}
              onPress={() => {}}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};
