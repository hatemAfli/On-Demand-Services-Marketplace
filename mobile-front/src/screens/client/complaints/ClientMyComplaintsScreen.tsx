import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isAxiosError } from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ClientStackParamList } from "../../../navigation/types";
import { COLORS } from "../../../constants";
import {
  api,
  type ClientComplaintRow,
  type ComplaintStatus,
} from "../../../services/api";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { CATEGORY_OPTIONS, getCategoryOption } from "./categoryMeta";
import { parseClientComplaintRow } from "./parseComplaint";
import {
  formatBookingDateTime,
  statusBarColor,
  statusPillStyle,
} from "./complaintUi";

const ACCENT = "#EA580C";
const ACCENT_LIGHT = "#FFF7ED";
const ACCENT_BORDER = "#FFEDD5";
const SCREEN_BG = "#F1F5F9";

type Props = NativeStackScreenProps<ClientStackParamList, "ClientMyComplaints">;

type StatusFilter = "ALL" | ComplaintStatus;

const FILTER_KEYS: { key: StatusFilter; labelKey: string }[] = [
  { key: "ALL", labelKey: "client.complaints.filters.all" },
  { key: "OPEN", labelKey: "client.complaints.filters.open" },
  { key: "UNDER_REVIEW", labelKey: "client.complaints.filters.underReview" },
  { key: "RESOLVED", labelKey: "client.complaints.filters.resolved" },
  { key: "DISMISSED", labelKey: "client.complaints.filters.dismissed" },
];

/* Status icon helper */
function statusIcon(status: string): { name: string; color: string } {
  switch (status) {
    case "OPEN":
      return { name: "radio-button-on-outline", color: "#F59E0B" };
    case "UNDER_REVIEW":
      return { name: "eye-outline", color: "#3B82F6" };
    case "RESOLVED":
      return { name: "checkmark-circle-outline", color: "#059669" };
    case "DISMISSED":
      return { name: "close-circle-outline", color: "#9B9BB0" };
    case "WITHDRAWN":
      return { name: "arrow-undo-outline", color: "#9B9BB0" };
    default:
      return { name: "ellipse-outline", color: "#C4C4C4" };
  }
}

export const ClientMyComplaintsScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ClientComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    void api
      .getMyComplaints()
      .then((res) => {
        const raw = Array.isArray(res.data) ? res.data : [];
        const next: ClientComplaintRow[] = [];
        for (const x of raw) {
          const row = parseClientComplaintRow(x);
          if (row) next.push(row);
        }
        setItems(next);
      })
      .catch(() => setItems([]))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      load({ silent: !isFirstFocus.current });
      isFirstFocus.current = false;
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("client.screenTitles.ClientMyComplaints"),
      headerTitleAlign: "center",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
      ),
      headerRight: () => <View style={{ width: 40, marginRight: 8 }} />,
    });
  }, [navigation, t]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((it) => it.status === filter);
  }, [items, filter]);

  const withdrawComplaint = useCallback(
    (row: ClientComplaintRow) => {
      Alert.alert(
        t("client.complaints.withdrawAlertTitle"),
        t("client.complaints.withdrawAlertMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("client.complaints.withdrawConfirmAction"),
            style: "destructive",
            onPress: () => {
              void api
                .withdrawComplaint(row.id)
                .then(() => {
                  setItems((prev) =>
                    prev.map((p) =>
                      p.id === row.id
                        ? { ...p, status: "WITHDRAWN" as const }
                        : p,
                    ),
                  );
                })
                .catch((err) => {
                  const msg = isAxiosError(err)
                    ? (err.response?.data as { message?: string })?.message
                    : undefined;
                  Alert.alert(
                    t("common.error"),
                    msg ?? t("client.complaints.withdrawError"),
                  );
                });
            },
          },
        ],
      );
    },
    [t],
  );

  const renderChip = (fk: StatusFilter, labelKey: string) => {
    const active = filter === fk;
    return (
      <TouchableOpacity
        key={fk}
        onPress={() => setFilter(fk)}
        style={[styles.chip, active && styles.chipActive]}
        activeOpacity={0.82}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {t(labelKey)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ClientComplaintRow }) => {
    const cat =
      getCategoryOption(item.category) ??
      CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];
    const bar = statusBarColor(item.status);
    const pill = statusPillStyle(item.status);
    const providerName =
      `${item.provider.firstName} ${item.provider.lastName}`.trim();
    const schedule = formatBookingDateTime(
      item.appointment.scheduledDate,
      item.appointment.scheduledTime,
    );
    const canWithdraw =
      item.status === "OPEN" || item.status === "UNDER_REVIEW";
    const decisionLabel =
      item.decision != null
        ? t(`client.complaints.decision.${item.decision}`)
        : null;
    const statusInfo = statusIcon(item.status);

    return (
      <View style={styles.cardWrap}>
        {/* Left status stripe */}
        <View style={[styles.statusBar, { backgroundColor: bar }]} />

        <View style={styles.cardBody}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate("ClientComplaintDetail", {
                complaintId: item.id,
              })
            }
          >
            {/* Category row + status pill */}
            <View style={styles.cardHeaderRow}>
              <View style={styles.catIconWrap}>
                <Ionicons name={cat.icon as any} size={16} color="#EA580C" />
              </View>
              <Text style={styles.categoryLabel} numberOfLines={1}>
                {cat.label}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: pill.bg, borderColor: pill.text + "30" },
                ]}
              >
                <Ionicons
                  name={statusInfo.name as any}
                  size={11}
                  color={statusInfo.color}
                />
                <Text style={[styles.statusPillText, { color: pill.text }]}>
                  {t(`client.complaints.status.${item.status}`)}
                </Text>
              </View>
            </View>

            {/* Provider row */}
            <View style={styles.metaRow}>
              {item.provider.photoUrl ? (
                <Image
                  source={{ uri: item.provider.photoUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {providerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.metaTextCol}>
                <Text style={styles.providerName} numberOfLines={1}>
                  {providerName}
                </Text>
                <View style={styles.scheduleRow}>
                  <Ionicons name="calendar-outline" size={11} color="#C4C4C4" />
                  <Text style={styles.scheduleLine} numberOfLines={1}>
                    {schedule}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
            </View>

            {/* Description preview */}
            <Text style={styles.preview} numberOfLines={2}>
              {item.description}
            </Text>

            {/* Admin response card */}
            {item.adminResponse ? (
              <View style={styles.adminCard}>
                <View style={styles.adminCardTitleRow}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={13}
                    color="#3B82F6"
                  />
                  <Text style={styles.adminCardTitle}>
                    {t("client.complaints.adminResponse")}
                  </Text>
                </View>
                <Text style={styles.adminCardBody}>{item.adminResponse}</Text>
              </View>
            ) : null}

            {/* Decision chip */}
            {decisionLabel ? (
              <View style={styles.decisionChip}>
                <Ionicons name="flag-outline" size={12} color="#6B6B80" />
                <Text style={styles.decisionChipText}>{decisionLabel}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Withdraw action */}
          {canWithdraw ? (
            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={() => withdrawComplaint(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-outline" size={13} color="#DC2626" />
              <Text style={styles.withdrawBtnText}>
                {t("client.complaints.withdraw")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {/* Filter chips */}
      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {FILTER_KEYS.map((x) => renderChip(x.key, x.labelKey))}
        </ScrollView>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#EA580C" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyContainer : styles.listPad
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#EA580C"
              colors={["#EA580C"]}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyInner}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="shield-outline" size={32} color="#EA580C" />
              </View>
              <Text style={styles.emptyTitle}>
                {t("client.complaints.emptyTitle")}
              </Text>
              <Text style={styles.emptySub}>
                {t("client.complaints.emptySubtitle")}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  /* ── Filter chips ── */
  chipsWrap: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBF5",
    paddingVertical: 2,
  },
  chipsScroll: { flexGrow: 0 },
  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#EBEBF5",
  },
  chipActive: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FFEDD5",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9B9BB0",
  },
  chipTextActive: {
    color: "#EA580C",
  },

  /* ── States ── */
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listPad: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 32,
  },
  emptyInner: {
    alignItems: "center",
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: "#9B9BB0",
    textAlign: "center",
    lineHeight: 19,
    fontWeight: "500",
  },

  /* ── Card ── */
  cardWrap: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EBEBF5",
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusBar: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 0,
  },

  /* Card header */
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  /* Provider meta row */
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    flexShrink: 0,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EA580C",
  },
  metaTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  providerName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.1,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scheduleLine: {
    fontSize: 11,
    color: "#9B9BB0",
    fontWeight: "500",
  },

  /* Description preview */
  preview: {
    fontSize: 13,
    color: "#6B6B80",
    lineHeight: 19,
    fontWeight: "400",
    marginBottom: 0,
  },

  /* Admin response */
  adminCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 6,
  },
  adminCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  adminCardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3B82F6",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  adminCardBody: {
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 18,
    fontWeight: "500",
  },

  /* Decision chip */
  decisionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#EBEBF5",
  },
  decisionChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B6B80",
  },

  /* Withdraw */
  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-end",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  withdrawBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
});
