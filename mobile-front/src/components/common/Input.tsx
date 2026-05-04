// src/components/common/Input.tsx

import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  style,
  multiline,
  ...props
}) => {
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const toggleSecure = () => {
    setIsSecure(!isSecure);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputContainer,
          error && styles.inputError,
          multiline && styles.inputContainerMultiline,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={COLORS.text.secondary}
            style={[styles.leftIcon, multiline && styles.leftIconMultiline]}
          />
        )}

        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            multiline && styles.inputMultiline,
            style,
          ]}
          placeholderTextColor={COLORS.text.tertiary}
          secureTextEntry={isSecure}
          multiline={multiline}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity onPress={toggleSecure} style={styles.rightIcon}>
            <Ionicons
              name={isSecure ? "eye-off" : "eye"}
              size={20}
              color={COLORS.text.secondary}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !secureTextEntry && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <Ionicons
              name={rightIcon}
              size={20}
              color={COLORS.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainerMultiline: {
    height: undefined,
    minHeight: 120,
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text.primary,
    height: 56,
    paddingVertical: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: 4,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  leftIcon: {
    marginRight: 8,
  },
  leftIconMultiline: {
    marginTop: 4,
  },
  rightIcon: {
    marginLeft: 8,
    padding: 4,
  },
  error: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 4,
  },
});
