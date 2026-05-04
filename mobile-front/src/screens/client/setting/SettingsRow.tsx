import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";

import { styles } from "./styles";

export type SettingsRowProps = {
  icon: React.ComponentProps<typeof FontAwesome6>["name"];
  iconBackground: string;
  iconColor: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
};

export function SettingsRow({
  icon,
  iconBackground,
  iconColor,
  title,
  subtitle,
  trailing,
  showChevron = true,
  destructive = false,
  onPress,
}: SettingsRowProps) {
  const content = (
    <>
      <View style={styles.rowLeft}>
        <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}>
          <FontAwesome6 name={icon} size={15} color={iconColor} />
        </View>
        <View style={styles.rowTextBlock}>
          <Text
            style={[styles.rowTitle, destructive && styles.destructiveText]}
          >
            {title}
          </Text>
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.rowRight}>
        {trailing}
        {showChevron ? (
          <FontAwesome6
            name="chevron-right"
            size={12}
            color="#CBD5E1"
            style={styles.chevron}
          />
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        style={styles.row}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.row}>{content}</View>;
}
