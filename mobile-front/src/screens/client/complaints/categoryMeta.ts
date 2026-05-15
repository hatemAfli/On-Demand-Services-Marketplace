import { Ionicons } from "@expo/vector-icons";
import type { ComplaintCategory } from "../../../services/api";

export type CategoryOption = {
  value: ComplaintCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "SERVICE_QUALITY", label: "Service quality", icon: "construct-outline" },
  { value: "NO_SHOW", label: "No-show", icon: "person-remove-outline" },
  { value: "LATE_ARRIVAL", label: "Late arrival", icon: "time-outline" },
  { value: "UNPROFESSIONAL", label: "Unprofessional", icon: "warning-outline" },
  { value: "OVERCHARGING", label: "Overcharging", icon: "cash-outline" },
  { value: "PROPERTY_DAMAGE", label: "Property damage", icon: "home-outline" },
  { value: "SAFETY_CONCERN", label: "Safety concern", icon: "shield-outline" },
  { value: "FRAUD", label: "Fraud", icon: "alert-circle-outline" },
  { value: "OTHER", label: "Other", icon: "ellipsis-horizontal-outline" },
];

export function getCategoryOption(
  category: string,
): CategoryOption | undefined {
  return CATEGORY_OPTIONS.find((o) => o.value === category);
}
