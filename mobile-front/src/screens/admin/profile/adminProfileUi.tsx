import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ACCENT = "#E8C97A";
export const ACCENT_DIM = "rgba(232,201,122,0.18)";
export const ACCENT_BORDER = "rgba(232,201,122,0.40)";

export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

export function AdminProfileSubHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[subHeaderStyles.wrap, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        onPress={onBack}
        style={subHeaderStyles.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="chevron-back" size={22} color="#1A1A2E" />
      </TouchableOpacity>
      <Text style={subHeaderStyles.title}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

const subHeaderStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
});

export type ProfileMenuRowProps = {
  icon: React.ComponentProps<typeof FontAwesome6>["name"];
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
  destructive?: boolean;
  onPress?: () => void;
};

export function ProfileMenuRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  trailing,
  destructive,
  onPress,
}: ProfileMenuRowProps) {
  const inner = (
    <>
      <View style={menuStyles.left}>
        <View style={[menuStyles.icon, { backgroundColor: iconBg }]}>
          <FontAwesome6 name={icon} size={15} color={iconColor} />
        </View>
        <View style={menuStyles.text}>
          <Text style={[menuStyles.title, destructive && menuStyles.destructive]}>
            {title}
          </Text>
          <Text style={menuStyles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={menuStyles.right}>
        {trailing}
        {onPress ? (
          <FontAwesome6 name="chevron-right" size={12} color="#CBD5E1" />
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={menuStyles.row} onPress={onPress} activeOpacity={0.88}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={menuStyles.row}>{inner}</View>;
}

export const profileScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: -8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 56,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  formHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
    fontWeight: "500",
  },
  saveBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400E",
  },
});

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 68,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    lineHeight: 16,
  },
  destructive: {
    color: "#DC2626",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
});
