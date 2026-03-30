// src/components/common/Button.tsx

import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from "react-native";
import { COLORS } from "../../constants";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline";
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  variant = "primary",
  fullWidth = true,
  disabled = false,
  style,
  textStyle,
  ...props
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle = styles.button;

    if (variant === "primary") {
      return { ...baseStyle, backgroundColor: COLORS.primary };
    } else if (variant === "secondary") {
      return { ...baseStyle, backgroundColor: COLORS.secondary };
    } else if (variant === "outline") {
      return {
        ...baseStyle,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: COLORS.primary,
      };
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = styles.text;

    if (variant === "outline") {
      return { ...baseStyle, color: COLORS.primary };
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[
        getButtonStyle(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" ? COLORS.primary : COLORS.white}
        />
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  fullWidth: {
    width: "100%",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
  disabled: {
    opacity: 0.5,
  },
});
