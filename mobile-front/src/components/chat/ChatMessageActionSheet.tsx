import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants";
import type { ChatMessage } from "../../services/api";

type Props = {
  visible: boolean;
  message: ChatMessage | null;
  bottomInset: number;
  onClose: () => void;
  onEdit: () => void;
  onWithdraw: () => void;
};

function messagePreview(message: ChatMessage): string {
  const text = message.text?.trim();
  if (text) {
    return text.length > 96 ? `${text.slice(0, 96)}…` : text;
  }
  if (message.mediaUrls.length > 0) return "Photo attachment";
  return "Message";
}

function canEditMessage(message: ChatMessage): boolean {
  return !!message.text?.trim();
}

export const ChatMessageActionSheet: React.FC<Props> = ({
  visible,
  message,
  bottomInset,
  onClose,
  onEdit,
  onWithdraw,
}) => {
  if (!message) return null;

  const editable = canEditMessage(message);
  const preview = messagePreview(message);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(bottomInset, 16) + 8 },
          ]}
        >
          <View style={styles.handle} />

          <Text style={styles.title}>Message options</Text>
          <Text style={styles.subtitle}>Choose what you want to do</Text>

          <View style={styles.previewCard}>
            <View style={styles.previewBubble}>
              <Text style={styles.previewText} numberOfLines={3}>
                {preview}
              </Text>
            </View>
            <View style={styles.previewMeta}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={COLORS.text.tertiary}
              />
              <Text style={styles.previewMetaText}>Your message</Text>
            </View>
          </View>

          <View style={styles.actions}>
            {editable ? (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={onEdit}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel="Edit message"
              >
                <View style={[styles.actionIcon, styles.actionIconEdit]}>
                  <Ionicons name="pencil" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Edit message</Text>
                  <Text style={styles.actionSubtitle}>
                    Change the text for everyone
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.gray[400]}
                />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[
                styles.actionRow,
                !editable && styles.actionRowOnly,
              ]}
              onPress={onWithdraw}
              activeOpacity={0.86}
              accessibilityRole="button"
              accessibilityLabel="Withdraw message"
            >
              <View style={[styles.actionIcon, styles.actionIconWithdraw]}>
                <Ionicons name="arrow-undo" size={20} color={COLORS.error} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={[styles.actionTitle, styles.actionTitleDanger]}>
                  Withdraw message
                </Text>
                <Text style={styles.actionSubtitle}>
                  Remove it from the conversation
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.gray[400]}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.82}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    borderBottomWidth: 0,
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: -8 },
    shadowRadius: 24,
    elevation: 16,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.12,
      },
    }),
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray[300],
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  previewCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewBubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.white,
    fontWeight: "500",
  },
  previewMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 10,
  },
  previewMetaText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.tertiary,
  },
  actions: {
    gap: 10,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionRowOnly: {
    marginTop: 0,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionIconEdit: {
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    borderColor: "rgba(79, 70, 229, 0.18)",
  },
  actionIconWithdraw: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  actionTitleDanger: {
    color: COLORS.error,
  },
  actionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text.secondary,
  },
  cancelBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: COLORS.gray[100],
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
});
