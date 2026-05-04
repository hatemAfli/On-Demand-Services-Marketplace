import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
  activeGivenCount: number;
};

type Props = {
  service: ServiceCardDisplay;
  onPress: () => void;
  providersCountLabel: string;
  /** e.g. fixed width for horizontal carousels */
  style?: StyleProp<ViewStyle>;
};

export const ServiceDiscoveryCard: React.FC<Props> = ({
  service,
  onPress,
  providersCountLabel,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      activeOpacity={0.93}
      onPress={onPress}
    >
      <View style={styles.cardMainRow}>
        <View style={styles.cardImageWrap}>
          <Image source={{ uri: service.image }} style={styles.cardImage} />
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
              <View style={styles.cardProviderCountRow}>
                <FontAwesome6 name="user-group" size={10} color="#6B7280" />
                <Text style={styles.cardProviderCountText}>
                  {providersCountLabel}
                </Text>
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
    </TouchableOpacity>
  );
};
