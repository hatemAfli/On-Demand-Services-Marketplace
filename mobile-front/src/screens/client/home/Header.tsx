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
  /** Shown above the address line (replaces the old “Delivering to” label). */
  clientName?: string;
  city?: string;
  address?: string;
  onSearchPress: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
  unreadNotificationCount?: number;
};

export const Header: React.FC<Props> = ({
  avatarUri,
  clientName,
  city,
  address,
  onSearchPress,
  onNotificationsPress,
  onProfilePress,
  unreadNotificationCount = 0,
}) => {
  const { t } = useAppTranslation();
  const locationText = clientLocationLine(city, address);
  const nameLine =
    clientName?.trim() || t("client.settings.guestName");

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity style={styles.addressButton}>
          <View style={styles.locationIconContainer}>
            <Icon name="location-arrow" size={14} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.headerClientName} numberOfLines={1}>
              {nameLine}
            </Text>
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
            {unreadNotificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText} numberOfLines={1}>
                  {unreadNotificationCount > 99
                    ? "99+"
                    : String(unreadNotificationCount)}
                </Text>
              </View>
            ) : null}
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
