import React from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Primary action styling */
  confirmVariant?: "primary" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

export const ConfirmModal: React.FC<Props> = ({
  visible,
  onDismiss,
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
  loading = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !loading && onDismiss()}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => !loading && onDismiss()}
      >
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
              confirmVariant === "destructive" && styles.iconRingWarn,
            ]}
          >
            <Ionicons
              name={
                confirmVariant === "destructive"
                  ? "warning-outline"
                  : "help-circle-outline"
              }
              size={32}
              color={
                confirmVariant === "destructive"
                  ? COLORS.error
                  : COLORS.primary
              }
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnSecondary, loading && styles.btnDisabled]}
              onPress={onDismiss}
              disabled={loading}
              activeOpacity={0.88}
            >
              <Text style={styles.btnSecondaryText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                confirmVariant === "destructive" && styles.btnDestructive,
                loading && styles.btnDisabled,
              ]}
              onPress={() => void onConfirm()}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
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
    paddingBottom: 22,
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
  iconRingWarn: {
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
  actions: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: 12,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnDestructive: {
    backgroundColor: COLORS.error,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
