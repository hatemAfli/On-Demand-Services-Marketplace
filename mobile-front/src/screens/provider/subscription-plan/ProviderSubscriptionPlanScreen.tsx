import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProviderStackParamList } from "../../../navigation/types";
import { useAppTranslation } from "../../../hooks/useAppTranslation";
import { COLORS } from "../../../constants";

type Nav = NativeStackNavigationProp<
  ProviderStackParamList,
  "ProviderSubscriptionPlan"
>;

type BillingCycle = "monthly" | "annual";

type UsageItem = {
  title: string;
  value: string;
  limit: string;
  percent: number;
  note: string;
  barColor: string;
};

type Plan = {
  key: string;
  name: string;
  price: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  features: string[];
  dark?: boolean;
  badge?: string;
  accent?: string;
};

type BillingItem = {
  invoice: string;
  date: string;
  amount: string;
  status: string;
};

const colors = {
  primary: "#7621C2",
  primaryDark: "#641BA5",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  dark: "#111827",
  darkCard: "#0B1220",
  lime: "#A3E635",
  blue: "#3B82F6",
};

const usageItems: UsageItem[] = [
  {
    title: "Active Providers",
    value: "18",
    limit: "20",
    percent: 90,
    note: "Approaching limit. Upgrade to add more.",
    barColor: colors.primary,
  },
  {
    title: "AI Analysis Credits",
    value: "850",
    limit: "1000",
    percent: 85,
    note: "Resets monthly.",
    barColor: colors.blue,
  },
  {
    title: "Data Storage",
    value: "12GB",
    limit: "50GB",
    percent: 24,
    note: "Plenty of space available.",
    barColor: colors.success,
  },
];

const plans: Plan[] = [
  {
    key: "basic",
    name: "Basic plan",
    price: "$10",
    description: "Essential features for up to 5 users.",
    primaryCta: "Select Plan",
    secondaryCta: "Chat to sales",
    features: [
      "Access to basic features",
      "Basic reporting and analytics",
      "Up to 5 individual users",
      "10GB data storage",
    ],
  },
  {
    key: "business",
    name: "Business plan",
    price: "$20",
    description: "Growing teams up to 20 users.",
    primaryCta: "Current Plan",
    secondaryCta: "Chat to sales",
    features: [
      "Everything in Basic plus...",
      "200+ integrations",
      "Advanced reporting and analytics",
      "Up to 20 individual users",
      "40GB data storage",
      "Priority chat support",
    ],
    dark: true,
    badge: "Popular",
    accent: colors.lime,
  },
  {
    key: "enterprise",
    name: "Enterprise plan",
    price: "$40",
    description: "Advanced features + unlimited users.",
    primaryCta: "Get started",
    secondaryCta: "Chat to sales",
    features: [
      "Everything in Business plus...",
      "Advanced custom fields",
      "Audit log and data history",
      "Unlimited individual users",
      "Unlimited data storage",
      "Personalized + priority service",
    ],
  },
];

const billingItems: BillingItem[] = [
  {
    invoice: "INV-2024-0012",
    date: "Oct 1, 2024",
    amount: "$360.00",
    status: "Paid",
  },
  {
    invoice: "INV-2024-0011",
    date: "Sep 1, 2024",
    amount: "$360.00",
    status: "Paid",
  },
  {
    invoice: "INV-2024-0010",
    date: "Aug 1, 2024",
    amount: "$320.00",
    status: "Paid",
  },
];

export function ProviderSubscriptionPlanScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useAppTranslation();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("provider.screenTitles.ProviderSubscriptionPlan"),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 8, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const priceSuffix = useMemo(
    () => (billingCycle === "annual" ? "/user/yr" : "/user/mo"),
    [billingCycle]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Subscription & Plan</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Business Plan</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Manage your subscription, billing details, and plan limits.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Text style={styles.iconText}>?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Text style={styles.iconText}>N</Text>
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>Billing Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Current Plan Usage</Text>
              <Text style={styles.sectionSubtitle}>
                Your plan renews on
                <Text style={styles.sectionSubtitleBold}> November 1, 2024</Text>.
              </Text>
            </View>
            <View style={styles.sectionHeaderRight}>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.linkText}>Manage Billing</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.usageGrid}>
            {usageItems.map((item) => (
              <View key={item.title} style={styles.usageCard}>
                <View style={styles.usageRow}>
                  <Text style={styles.usageLabel}>{item.title}</Text>
                  <Text style={styles.usageValue}>
                    {item.value}
                    <Text style={styles.usageLimit}> / {item.limit}</Text>
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${item.percent}%`, backgroundColor: item.barColor },
                    ]}
                  />
                </View>
                <Text style={styles.usageNote}>{item.note}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.centeredHeader}>
            <Text style={styles.sectionTitleLarge}>Upgrade your plan</Text>
            <Text style={styles.sectionSubtitle}>
              Scale your operations with advanced features and higher limits.
            </Text>
            <View style={styles.toggleWrap}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  billingCycle === "monthly" && styles.toggleButtonActive,
                ]}
                onPress={() => setBillingCycle("monthly")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    billingCycle === "monthly" && styles.toggleTextActive,
                  ]}
                >
                  Monthly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  billingCycle === "annual" && styles.toggleButtonActive,
                ]}
                onPress={() => setBillingCycle("annual")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    billingCycle === "annual" && styles.toggleTextActive,
                  ]}
                >
                  Annual
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.planStack}>
            {plans.map((plan) => {
              const isDark = Boolean(plan.dark);
              return (
                <View
                  key={plan.key}
                  style={[
                    styles.planCard,
                    isDark && styles.planCardDark,
                  ]}
                >
                  {plan.badge ? (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.planTitle, isDark && styles.textLight]}>
                    {plan.name}
                  </Text>
                  <View style={styles.planPriceRow}>
                    <Text style={[styles.planPrice, isDark && styles.textLight]}>
                      {plan.price}
                    </Text>
                    <Text
                      style={[
                        styles.planPriceSuffix,
                        isDark && styles.textMutedLight,
                      ]}
                    >
                      {priceSuffix}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.planDescription,
                      isDark && styles.textMutedLight,
                    ]}
                  >
                    {plan.description}
                  </Text>

                  <View style={styles.planButtons}>
                    <TouchableOpacity
                      style={[
                        styles.planPrimary,
                        isDark && styles.planPrimaryDark,
                        plan.accent ? { backgroundColor: plan.accent } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.planPrimaryText,
                          isDark && styles.planPrimaryTextDark,
                        ]}
                      >
                        {plan.primaryCta}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.planSecondary,
                        isDark && styles.planSecondaryDark,
                      ]}
                    >
                      <Text
                        style={[
                          styles.planSecondaryText,
                          isDark && styles.planSecondaryTextDark,
                        ]}
                      >
                        {plan.secondaryCta}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.featureTitle, isDark && styles.textLight]}>
                    Features
                  </Text>
                  <View style={styles.featureList}>
                    {plan.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <View
                          style={[
                            styles.featureDot,
                            isDark && styles.featureDotDark,
                          ]}
                        />
                        <Text
                          style={[
                            styles.featureText,
                            isDark && styles.textMutedLight,
                          ]}
                        >
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.splitRow}>
          <View style={styles.billingCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Billing History</Text>
              <TouchableOpacity>
                <Text style={styles.linkText}>Download All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            {billingItems.map((item, index) => (
              <View key={item.invoice}>
                <View style={styles.billingRow}>
                  <View style={styles.billingLeft}>
                    <Text style={styles.billingInvoice}>{item.invoice}</Text>
                    <Text style={styles.billingDate}>{item.date}</Text>
                  </View>
                  <View style={styles.billingRight}>
                    <Text style={styles.billingAmount}>{item.amount}</Text>
                    <View style={styles.paidPill}>
                      <Text style={styles.paidPillText}>{item.status}</Text>
                    </View>
                    <TouchableOpacity>
                      <Text style={styles.linkText}>Download</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {index !== billingItems.length - 1 ? (
                  <View style={styles.rowDivider} />
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.paymentCard}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentMethod}>
              <View style={styles.paymentIcon}>
                <Text style={styles.paymentIconText}>V</Text>
              </View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentTitle}>Visa ending in 4242</Text>
                <Text style={styles.paymentSubtitle}>Expiry 12/2025</Text>
              </View>
              <View style={styles.defaultPill}>
                <Text style={styles.defaultPillText}>Default</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.dashedButton}>
              <Text style={styles.dashedButtonText}>Add Payment Method</Text>
            </TouchableOpacity>

            <View style={styles.divider} />
            <View style={styles.billingContact}>
              <View style={styles.contactIcon}>
                <Text style={styles.contactIconText}>@</Text>
              </View>
              <View style={styles.billingContactText}>
                <Text style={styles.paymentTitle}>Billing Contact</Text>
                <Text style={styles.paymentSubtitle}>billing@hirewise.com</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.linkText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.banner}>
          <View style={styles.bannerGlow} />
          <View style={styles.bannerContent}>
            <View>
              <Text style={styles.bannerTitle}>
                Need a custom enterprise solution?
              </Text>
              <Text style={styles.bannerSubtitle}>
                For multi-branch operations, dedicated support, and custom API
                limits, talk to our enterprise team.
              </Text>
            </View>
            <TouchableOpacity style={styles.bannerButton}>
              <Text style={styles.bannerButtonText}>Contact Sales</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            (c) 2024 HireWise Inc. All rights reserved.
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.footerLinkText}>Help Center</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    gap: 24,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 16,
  },
  headerLeft: {
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  badge: {
    backgroundColor: "#DBEAFE",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  iconText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "700",
  },
  notificationDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  ghostButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  ghostButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 16,
  },
  sectionHeader: {
    gap: 12,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionTitleLarge: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 12,
  },
  sectionSubtitleBold: {
    color: colors.text,
    fontWeight: "600",
  },
  activePill: {
    backgroundColor: "#ECFDF3",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activePillText: {
    fontSize: 11,
    color: "#15803D",
    fontWeight: "700",
  },
  linkText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 12,
  },
  usageGrid: {
    gap: 16,
  },
  usageCard: {
    gap: 8,
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  usageLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  usageValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  usageLimit: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  usageNote: {
    color: colors.muted,
    fontSize: 11,
  },
  sectionBlock: {
    gap: 20,
  },
  centeredHeader: {
    alignItems: "center",
    gap: 10,
  },
  toggleWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: colors.card,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  toggleTextActive: {
    color: colors.text,
  },
  planStack: {
    gap: 16,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  planCardDark: {
    backgroundColor: colors.dark,
    borderColor: "#1F2937",
  },
  planBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.lime,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.dark,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  planPriceSuffix: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  planDescription: {
    fontSize: 12,
    color: colors.muted,
  },
  planButtons: {
    gap: 8,
    marginTop: 8,
  },
  planPrimary: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  planPrimaryDark: {
    backgroundColor: colors.lime,
  },
  planPrimaryText: {
    color: colors.card,
    fontWeight: "700",
    fontSize: 12,
  },
  planPrimaryTextDark: {
    color: colors.dark,
  },
  planSecondary: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  planSecondaryDark: {
    backgroundColor: colors.card,
  },
  planSecondaryText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  planSecondaryTextDark: {
    color: colors.dark,
  },
  featureTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    marginTop: 4,
  },
  featureList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#86EFAC",
    marginTop: 6,
  },
  featureDotDark: {
    backgroundColor: colors.lime,
  },
  featureText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
  },
  splitRow: {
    gap: 16,
  },
  billingCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  billingLeft: {
    gap: 4,
  },
  billingRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  billingInvoice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  billingDate: {
    fontSize: 12,
    color: colors.muted,
  },
  billingAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  paidPill: {
    backgroundColor: "#ECFDF3",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  paidPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  paymentCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  paymentIcon: {
    width: 40,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  paymentIconText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
  },
  paymentDetails: {
    flex: 1,
    gap: 2,
  },
  paymentTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  paymentSubtitle: {
    fontSize: 11,
    color: colors.muted,
  },
  defaultPill: {
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  dashedButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  dashedButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  billingContact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  contactIconText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  billingContactText: {
    flex: 1,
    gap: 2,
  },
  banner: {
    backgroundColor: colors.dark,
    borderRadius: 16,
    padding: 20,
    overflow: "hidden",
  },
  bannerGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#FFFFFF",
    opacity: 0.08,
  },
  bannerContent: {
    gap: 12,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.card,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "#CBD5F5",
    marginTop: 6,
  },
  bannerButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bannerButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.dark,
  },
  footer: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 11,
    color: colors.muted,
  },
  footerLinks: {
    flexDirection: "row",
    gap: 16,
  },
  footerLinkText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },
  textLight: {
    color: colors.card,
  },
  textMutedLight: {
    color: "#94A3B8",
  },
});
