import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FontAwesome5 as Icon, Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { clientLocationLine } from "./clientLocationLine";
import { styles } from "./styles";

type Props = {
  avatarUri?: string;
  city?: string;
  address?: string;
  onSearchPress: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
};

export const Header: React.FC<Props> = ({
  avatarUri,
  city,
  address,
  onSearchPress,
  onNotificationsPress,
  onProfilePress,
}) => {
  const { t } = useAppTranslation();
  const locationText = clientLocationLine(city, address);

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity style={styles.addressButton}>
          <View style={styles.locationIconContainer}>
            <Icon name="location-arrow" size={14} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.deliveringTo}>Delivering to</Text>
            <View style={styles.addressTextContainer}>
              <Text style={styles.addressText}>
                {locationText.length > 0
                  ? locationText
                  : t("client.home.deliveryAddressPlaceholder")}
              </Text>
              <Icon name="chevron-down" size={12} color="#9ca3af" />
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationsPress}
          >
            <Icon name="bell" size={20} color="#4b5563" solid />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={onProfilePress}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={20} color="#4F46E5" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchContainer}>
        <Pressable onPress={onSearchPress} style={styles.searchInputContainer}>
          <Icon name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
          <Text style={localStyles.placeholderText}>Search services...</Text>
        </Pressable>
        <TouchableOpacity style={styles.filterButton}>
          <Icon name="sliders-h" size={16} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  placeholderText: { flex: 1, fontSize: 14, color: "#6B7280", fontWeight: "500" },
});
