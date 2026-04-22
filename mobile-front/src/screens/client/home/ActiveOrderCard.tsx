import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { FontAwesome5 as Icon } from "@expo/vector-icons";
import { styles } from "./styles";

export const ActiveOrderCard: React.FC = () => (
  <View style={styles.activeOrderContainer}>
    <View style={styles.activeOrderCard}>
      <View style={styles.cardPattern} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.orderIconContainer}>
              <Icon name="motorcycle" size={18} color="#fff" />
            </View>
            <View>
              <Text style={styles.orderId}>Order #2841</Text>
              <View style={styles.orderStatus}>
                <View style={styles.statusIndicator} />
                <Text style={styles.statusText}>On the way • 12 mins</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.trackButton}>
            <Text style={styles.trackButtonText}>Track</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressBarBackground}>
          <View style={styles.progressBarFill} />
        </View>
        <View style={styles.orderDetails}>
          <Text style={styles.orderItems}>McDonald's • 2 items</Text>
          <Text style={styles.orderPrice}>SAR 45.00</Text>
        </View>
      </View>
    </View>
  </View>
);
