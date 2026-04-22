import React from "react";
import { AdminScreenTemplate } from "./AdminScreenTemplate";

export const AdminDashboardScreen: React.FC = () => {
  return (
    <AdminScreenTemplate
      title="Dashboard"
      subtitle="Monitor platform performance and key metrics at a glance."
      icon="speedometer-outline"
      quickActions={["Today Overview", "Recent Activity", "Alerts", "KPIs"]}
    />
  );
};
