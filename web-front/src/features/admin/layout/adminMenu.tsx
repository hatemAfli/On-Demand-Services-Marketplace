import type { IconType } from "react-icons";
import {
  FaCalendarCheck,
  FaClockRotateLeft,
  FaFileLines,
  FaFolderTree,
  FaGaugeHigh,
  FaHandshake,
  FaListCheck,
  FaMessage,
  FaShieldHalved,
  FaStar,
  FaTriangleExclamation,
  FaUsers,
} from "react-icons/fa6";

export type MenuCountProps = {
  pendingVerificationTotal: number;
  pendingProviderVerifications: number;
  pendingCompanyVerifications: number;
  openReclamations: number;
};

export type AdminMenuItem = {
  key: string;
  label: string;
  icon: IconType;
  badge?: number;
};

export type AdminMenuSection = {
  title: string;
  items: AdminMenuItem[];
};

export function buildAdminMenuSections(c: MenuCountProps): AdminMenuSection[] {
  return [
    {
      title: "Main Menu",
      items: [
        { key: "/admin/dashboard", label: "Dashboard", icon: FaGaugeHigh },
      ],
    },
    {
      title: "Users & Companies",
      items: [
        { key: "/admin/users/all", label: "All Users", icon: FaUsers },
        { key: "/admin/companies", label: "Companies", icon: FaHandshake },
      ],
    },
    {
      title: "Validation",
      items: [
        {
          key: "/admin/validations/pending-providers",
          label: "Pending Providers",
          icon: FaShieldHalved,
          badge: c.pendingProviderVerifications,
        },
        {
          key: "/admin/validations/pending-companies",
          label: "Pending Companies",
          icon: FaListCheck,
          badge: c.pendingCompanyVerifications,
        },
        {
          key: "/admin/validations/history",
          label: "Validation History",
          icon: FaClockRotateLeft,
        },
      ],
    },
    {
      title: "Catalog",
      items: [
        {
          key: "/admin/catalog/categories",
          label: "Categories",
          icon: FaFolderTree,
        },
        {
          key: "/admin/catalog/services",
          label: "Services",
          icon: FaFileLines,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          key: "/admin/appointments/list",
          label: "Appointments",
          icon: FaCalendarCheck,
        },
        {
          key: "/admin/reclamations",
          label: "Reclamations",
          icon: FaTriangleExclamation,
          badge: c.openReclamations,
        },
        { key: "/admin/reviews", label: "Reviews & Ratings", icon: FaStar },
      ],
    },
    {
      title: "Support & Content",
      items: [
        {
          key: "/admin/messages",
          label: "Messages & Support",
          icon: FaMessage,
        },
        {
          key: "/admin/content/legal-documents",
          label: "Terms & Privacy",
          icon: FaFileLines,
        },
        { key: "/admin/content/faq", label: "FAQ", icon: FaFileLines },
      ],
    },
    {
      title: "System",
      items: [
        {
          key: "/admin/activity-logs",
          label: "Activity Logs",
          icon: FaClockRotateLeft,
        },
      ],
    },
  ];
}

export function resolveAdminPageMeta(pathname: string): {
  label: string;
  icon: IconType | null;
} {
  const sections = buildAdminMenuSections({
    pendingVerificationTotal: 0,
    pendingProviderVerifications: 0,
    pendingCompanyVerifications: 0,
    openReclamations: 0,
  });

  for (const section of sections) {
    for (const item of section.items) {
      if (pathname === item.key || pathname.startsWith(`${item.key}/`)) {
        return { label: item.label, icon: item.icon };
      }
    }
  }

  if (pathname.startsWith("/admin/users/") && pathname !== "/admin/users/all") {
    return { label: "User details", icon: null };
  }
  if (
    pathname.startsWith("/admin/appointments/") &&
    pathname !== "/admin/appointments/list"
  ) {
    return { label: "Appointment details", icon: null };
  }
  if (pathname.startsWith("/admin/reclamations/")) {
    return { label: "Complaint review", icon: null };
  }
  if (pathname.startsWith("/admin/reviews/")) {
    return { label: "Review details", icon: null };
  }

  return { label: "Administration", icon: null };
}

export function resolveAdminSubtitle(pathname: string): string {
  if (pathname === "/admin/dashboard") {
    return "Overview of platform activity, queues, and key metrics.";
  }
  if (pathname.startsWith("/admin/validations")) {
    return "Review provider and company verification requests.";
  }
  if (pathname.startsWith("/admin/catalog")) {
    return "Manage marketplace service categories and catalog entries.";
  }
  if (pathname.startsWith("/admin/activity-logs")) {
    return "Audit trail of platform administrator actions.";
  }
  return "";
}
