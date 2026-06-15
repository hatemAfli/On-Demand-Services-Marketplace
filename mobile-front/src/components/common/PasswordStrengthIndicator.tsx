// src/components/common/PasswordStrengthIndicator.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  scorePasswordStrength,
  type PasswordStrengthLevel,
} from "../../utils/passwordStrength";
import { useAppTranslation } from "../../hooks/useAppTranslation";

const BAR_COLORS: Record<Exclude<PasswordStrengthLevel, 0>, string> = {
  1: "#EF4444",
  2: "#F59E0B",
  3: "#E8C97A",
  4: "#22C55E",
};

type Props = {
  password: string;
  /** Use "light" on pale form backgrounds (e.g. SignUp). Default: "light". */
  variant?: "light" | "dark";
};

export const PasswordStrengthIndicator: React.FC<Props> = ({
  password,
  variant = "light",
}) => {
  const { t, isRTL } = useAppTranslation();
  const { level } = scorePasswordStrength(password);

  if (!password.length || level === 0) {
    return null;
  }

  const strengthTier = level as 1 | 2 | 3 | 4;

  const labelKey =
    strengthTier === 1
      ? "auth.passwordStrengthWeak"
      : strengthTier === 2
        ? "auth.passwordStrengthFair"
        : strengthTier === 3
          ? "auth.passwordStrengthGood"
          : "auth.passwordStrengthStrong";

  const isLight = variant === "light";
  const inactiveBar = isLight ? "#CBD5E1" : "rgba(255,255,255,0.12)";

  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.label,
          isLight ? styles.labelLight : styles.labelDark,
          isRTL && styles.rtlText,
        ]}
      >
        {t("auth.passwordStrengthLabel")}: {t(labelKey)}
      </Text>
      <View style={[styles.bars, isRTL && styles.barsRtl]}>
        {([1, 2, 3, 4] as const).map((i) => {
          const active = strengthTier >= i;
          const color = active ? BAR_COLORS[strengthTier] : inactiveBar;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                { backgroundColor: color },
                active && styles.barActive,
              ]}
            />
          );
        })}
      </View>
      <Text
        style={[
          styles.hint,
          isLight ? styles.hintLight : styles.hintDark,
          isRTL && styles.rtlText,
        ]}
      >
        {t("auth.passwordStrengthHint")}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  labelLight: {
    color: "#334155",
  },
  labelDark: {
    color: "rgba(255,255,255,0.88)",
  },
  bars: {
    flexDirection: "row",
    gap: 6,
  },
  barsRtl: {
    flexDirection: "row-reverse",
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  barActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  hintLight: {
    color: "#64748B",
  },
  hintDark: {
    color: "rgba(181, 184, 201, 0.95)",
  },
  rtlText: {
    writingDirection: "rtl",
    textAlign: "right",
  },
});
