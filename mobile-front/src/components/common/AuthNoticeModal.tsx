import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "../../hooks/useAppTranslation";
import { COLORS } from "../../constants";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  /**
   * When the primary action is not “Close” (e.g. “Go to login”), show a secondary
   * dismiss control. Omit for simple alerts where the primary button already closes.
   */
  showDismissLink?: boolean;
};

export const AuthNoticeModal: React.FC<Props> = ({
  visible,
  onClose,
  title,
  message,
  primaryLabel,
  onPrimary,
  showDismissLink = false,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  const isErrorTitle =
    /error|erreur|خطأ/i.test(title) || title.toLowerCase().includes("error");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, 16) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={[
              styles.iconRing,
              isErrorTitle && styles.iconRingError,
            ]}
          >
            <Ionicons
              name={isErrorTitle ? "alert-circle-outline" : "information-circle-outline"}
              size={32}
              color={isErrorTitle ? COLORS.error : COLORS.primary}
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={styles.primaryBtnWrap}
            onPress={() => {
              onPrimary();
              onClose();
            }}
            activeOpacity={0.92}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryLabel}>{primaryLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {showDismissLink ? (
            <TouchableOpacity onPress={onClose} style={styles.dismiss} hitSlop={12}>
              <Text style={styles.dismissText}>{t("common.close")}</Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    shadowColor: "#4338ca",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.12,
      },
    }),
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(79, 70, 229, 0.2)",
  },
  iconRingError: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 24,
  },
  primaryBtnWrap: {
    alignSelf: "stretch",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },
  dismiss: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dismissText: {
    color: COLORS.text.tertiary,
    fontSize: 15,
    fontWeight: "600",
  },
});
