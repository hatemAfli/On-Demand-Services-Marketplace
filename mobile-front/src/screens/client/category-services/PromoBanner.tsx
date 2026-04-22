import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { styles } from "./styles";

type Props = {
  offerLabel: string;
  title: string;
  subtitle: string;
  claimLabel: string;
};

export const PromoBanner: React.FC<Props> = ({
  offerLabel,
  title,
  subtitle,
  claimLabel,
}) => {
  return (
    <View style={styles.promoBanner}>
      <View>
        <Text style={styles.offerLabel}>{offerLabel}</Text>
        <Text style={styles.offerTitle}>{title}</Text>
        <Text style={styles.offerSubtitle}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={styles.claimButton} activeOpacity={0.88}>
        <Text style={styles.claimButtonText}>{claimLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};
