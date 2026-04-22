import React from "react";
import { ScrollView, View, Text } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { styles } from "./styles";

type Props = {
  filtersLabel: string;
  chipRating: string;
  chipBestPrice: string;
  chipInstant: string;
};

export const ServiceFilterChips: React.FC<Props> = ({
  filtersLabel,
  chipRating,
  chipBestPrice,
  chipInstant,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      <View style={[styles.chip, styles.chipPrimary]}>
        <FontAwesome6 name="sliders" size={11} color="#FFFFFF" />
        <Text style={styles.chipPrimaryText}>{filtersLabel}</Text>
      </View>
      <View style={styles.chip}>
        <FontAwesome6 name="star" size={11} color="#FBBF24" />
        <Text style={styles.chipText}>{chipRating}</Text>
      </View>
      <View style={styles.chip}>
        <FontAwesome6 name="tag" size={11} color="#818CF8" />
        <Text style={styles.chipText}>{chipBestPrice}</Text>
      </View>
      <View style={styles.chip}>
        <FontAwesome6 name="bolt" size={11} color="#F59E0B" />
        <Text style={styles.chipText}>{chipInstant}</Text>
      </View>
    </ScrollView>
  );
};
