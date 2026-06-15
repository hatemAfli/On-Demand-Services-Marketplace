import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons, FontAwesome6 } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export const ACCENT = "#EA580C";
export const ACCENT_DARK = "#C2410C";
export const ACCENT_DIM = "#FFF7ED";
export const ACCENT_BORDER = "#FFEDD5";
export const ACCENT_RING = "#F08E10";

export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  const s = (a + b).toUpperCase();
  return s || "?";
}

export function AdminSettingsFormLayout({
  onBack,
  children,
}: {
  onBack: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={adminFormStyles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={[adminFormStyles.topBackContainer, { top: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={onBack}
          style={adminFormStyles.backButton}
          activeOpacity={0.8}
        >
          <Text style={adminFormStyles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={adminFormStyles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            adminFormStyles.scrollContent,
            {
              paddingTop: insets.top + 60,
              paddingBottom: 24 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AdminFormCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[adminFormStyles.card, style]}>{children}</View>;
}

export function AdminFormCardHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={adminFormStyles.headerRow}>
      <View style={adminFormStyles.iconWrap}>
        <Ionicons name={icon} size={20} color={ACCENT} />
      </View>
      <View style={adminFormStyles.headerTextWrap}>
        <Text style={adminFormStyles.title}>{title}</Text>
        {subtitle ? (
          <Text style={adminFormStyles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function AdminFormSaveButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        adminFormStyles.saveButton,
        (disabled || loading) && adminFormStyles.saveButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={adminFormStyles.saveButtonContent}>
          <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
          <Text style={adminFormStyles.saveButtonText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function AdminFormSentCard({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={adminFormStyles.sentCard}>
      <Ionicons name={icon} size={24} color={ACCENT} />
      <Text style={adminFormStyles.sentTitle}>{title}</Text>
      <Text style={adminFormStyles.sentText}>{message}</Text>
    </View>
  );
}

export function AdminProfileInitialsAvatar({ label }: { label: string }) {
  return (
    <View style={adminFormStyles.avatarSection}>
      <View style={adminFormStyles.avatarOuterRing}>
        <View style={adminFormStyles.avatarRingInner}>
          <View style={adminFormStyles.avatarPlaceholder}>
            <Text style={adminFormStyles.avatarInitials}>{label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

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
    backgroundColor: "#F4F3FA",
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
});

export const adminFormStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },
  container: { flex: 1 },
  topBackContainer: {
    position: "absolute",
    left: 24,
    zIndex: 10,
  },
  backButton: { paddingVertical: 8, paddingHorizontal: 8 },
  backText: { color: ACCENT, fontSize: 16, fontWeight: "600" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ACCENT_DIM,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  subtitle: { marginTop: 4, fontSize: 12, color: "#64748B" },
  form: { gap: 8, marginBottom: 12 },
  avatarSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  avatarOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT_RING,
    padding: 4,
    shadowColor: ACCENT_RING,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: 46,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    flex: 1,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: "#FDBA74",
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: "800",
    color: ACCENT_DARK,
    letterSpacing: -1,
  },
  saveButton: {
    alignSelf: "center",
    minWidth: 200,
    height: 48,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACCENT_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 10,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sentCard: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_DIM,
    padding: 14,
    gap: 8,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  sentTitle: { fontSize: 16, fontWeight: "700", color: "#9A3412" },
  sentText: { fontSize: 13, color: ACCENT_DARK },
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
