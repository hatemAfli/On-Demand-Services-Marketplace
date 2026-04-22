import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { styles } from "./styles";

export type ServiceCardDisplay = {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
  unit: string;
  image: string;
  rating: string;
  reviews: string;
  meta: string;
  badge?: string;
  highDemand?: boolean;
};

type Props = {
  service: ServiceCardDisplay;
  onPress: () => void;
  vatLabel: string;
  highDemandLabel: string;
};

export const ServiceDiscoveryCard: React.FC<Props> = ({
  service,
  onPress,
  vatLabel,
  highDemandLabel,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.93}
      onPress={onPress}
    >
      {service.badge ? (
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>{service.badge}</Text>
        </View>
      ) : null}

      <View style={styles.cardMainRow}>
        <View style={styles.cardImageWrap}>
          <Image source={{ uri: service.image }} style={styles.cardImage} />
          {service.highDemand ? (
            <View style={styles.demandOverlay}>
              <Text style={styles.demandText}>{highDemandLabel}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardInfo}>
          <View>
            <Text style={styles.cardTitle}>{service.title}</Text>
            <Text style={styles.cardDescription} numberOfLines={3}>
              {service.description}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <View>
              <View style={styles.durationRow}>
                <FontAwesome6 name="clock" size={10} color="#D1D5DB" />
                <Text style={styles.durationText}>{service.duration}</Text>
              </View>
              <View style={styles.priceTextRow}>
                <Text style={styles.priceText}>{service.price}</Text>
                {service.unit ? (
                  <Text style={styles.unitText}>{service.unit}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.addButton}>
              <FontAwesome6 name="plus" size={11} color="#4F46E5" />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.metaRow}>
          <FontAwesome6 name="star" size={10} color="#FBBF24" />
          <Text style={styles.rating}>{service.rating}</Text>
          <Text style={styles.reviews}>{service.reviews}</Text>
        </View>
        <Text style={styles.metaText}>{service.meta}</Text>
        <Text style={styles.vatText}>{vatLabel}</Text>
      </View>
    </TouchableOpacity>
  );
};
