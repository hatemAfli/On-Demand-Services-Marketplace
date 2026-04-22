import React from "react";
import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { FontAwesome5 as Icon, Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

type Props = {
  avatarUri?: string;
  city?: string;
  address?: string;
  onNotificationsPress: () => void;
};

export const Header: React.FC<Props> = ({
  avatarUri,
  city,
  address,
  onNotificationsPress,
}) => {
  const locationText = [city?.trim(), address?.trim()].filter(Boolean).join(" • ");

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
                {locationText.length > 0 ? locationText : "Al Olaya"}
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
          <View style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={20} color="#4F46E5" />
            )}
          </View>
        </View>
      </View>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor="#9ca3af"
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Icon name="sliders-h" size={16} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
