// src/constants/colors.ts

export const COLORS = {
  // Primary colors
  primary: "#4F46E5", // Indigo
  primaryDark: "#4338CA",
  primaryLight: "#818CF8",

  // Secondary colors
  secondary: "#10B981", // Green
  secondaryDark: "#059669",
  secondaryLight: "#34D399",

  // Neutral colors
  white: "#FFFFFF",
  black: "#000000",
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },

  // Semantic colors
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Background
  background: "#F9FAFB",
  surface: "#FFFFFF",

  // Text
  text: {
    primary: "#111827",
    secondary: "#6B7280",
    tertiary: "#9CA3AF",
    inverse: "#FFFFFF",
  },

  // Border
  border: "#E5E7EB",

  // Role-specific colors (optional)
  roles: {
    client: "#3B82F6",
    provider: "#10B981",
    company: "#8B5CF6",
    admin: "#EF4444",
  },
} as const;
