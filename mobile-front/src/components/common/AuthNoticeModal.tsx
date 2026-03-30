import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTranslation } from "../../hooks/useAppTranslation";

const ACCENT = "#E8C97A";

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
};

export const AuthNoticeModal: React.FC<Props> = ({
  visible,
  onClose,
  title,
  message,
  primaryLabel,
  onPrimary,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.cardOuter, { marginBottom: Math.max(insets.bottom, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={["rgba(232,201,122,0.45)", "rgba(139,92,246,0.35)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardBorder}
          >
            <View style={styles.cardInner}>
              <View style={styles.iconWrap}>
                <Ionicons name="mail-unread-outline" size={36} color={ACCENT} />
              </View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onPrimary();
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#4F46E5", "#6366F1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Text style={styles.primaryLabel}>{primaryLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.dismiss}>
                <Text style={styles.dismissText}>{t("common.close")}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cardOuter: {
    width: "100%",
    maxWidth: 400,
  },
  cardBorder: {
    borderRadius: 20,
    padding: 1.5,
  },
  cardInner: {
    backgroundColor: "#12182A",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(232,201,122,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(232,201,122,0.25)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: "#B5B8C9",
    textAlign: "center",
    marginBottom: 22,
  },
  primaryBtn: {
    alignSelf: "stretch",
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dismiss: {
    marginTop: 14,
    padding: 8,
  },
  dismissText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 18,
  },
});
