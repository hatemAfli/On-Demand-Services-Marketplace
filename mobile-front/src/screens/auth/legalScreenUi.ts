import { StyleSheet } from "react-native";

export const LEGAL_ACCENT = "#EA580C";
export const LEGAL_ACCENT_DARK = "#C2410C";
export const LEGAL_ACCENT_SOFT = "#FFF7ED";
export const LEGAL_ACCENT_BORDER = "#FFEDD5";
export const LEGAL_SCREEN_BG = "#F1F5F9";

export const legalScreenStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LEGAL_SCREEN_BG },
  scroll: { flex: 1, backgroundColor: LEGAL_SCREEN_BG },
  topBackContainer: {
    position: "absolute",
    left: 20,
    zIndex: 10,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  back: {
    color: LEGAL_ACCENT,
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 28,
    width: "100%",
  },
  content: {
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: LEGAL_ACCENT_SOFT,
    borderWidth: 1,
    borderColor: LEGAL_ACCENT_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1 },
  title: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    color: LEGAL_ACCENT_DARK,
    fontSize: 14,
    fontWeight: "600",
  },
  errorBox: {
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
    marginBottom: 14,
  },
  error: {
    color: "#B91C1C",
    lineHeight: 20,
    fontSize: 13,
    fontWeight: "500",
  },
  rtl: { textAlign: "right", writingDirection: "rtl" },
});
