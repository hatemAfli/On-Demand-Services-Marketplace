import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { styles } from "./styles";

const ICONS = ["layer-group", "fire", "star", "tags"] as const;

type Props = {
  labels: [string, string, string, string];
};

export const SubCategoryChips: React.FC<Props> = ({ labels }) => {
  const [active, setActive] = useState(0);

  return (
    <View style={styles.subCategoriesRow}>
      {labels.map((label, i) => {
        const isActive = active === i;
        return (
          <TouchableOpacity
            key={label}
            style={styles.subItem}
            onPress={() => setActive(i)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.subIconWrap,
                isActive ? styles.subIconWrapActive : undefined,
              ]}
            >
              <FontAwesome6
                name={ICONS[i] ?? "circle"}
                size={18}
                color={isActive ? "#4F46E5" : "#6B7280"}
              />
            </View>
            <Text style={styles.subText}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
