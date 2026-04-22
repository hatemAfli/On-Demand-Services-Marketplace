import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { styles } from "./styles";

type Props = {
  title: string;
  onBack: () => void;
};

export const CategoryServicesHeader: React.FC<Props> = ({ title, onBack }) => {
  return (
    <View style={[styles.header, { borderBottomWidth: 0 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <FontAwesome6 name="arrow-left" size={14} color="#4B5563" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity style={styles.circleButton} disabled>
          <FontAwesome6 name="cart-shopping" size={14} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
