import React from "react";
import { AdminScreenTemplate } from "./AdminScreenTemplate";

export const AdminReclamationsScreen: React.FC = () => {
  return (
    <AdminScreenTemplate
      title="Reclamations"
      subtitle="Track user complaints, escalations, and resolution progress."
      icon="chatbox-ellipses-outline"
      quickActions={["New Claims", "In Progress", "Resolved", "Escalations"]}
    />
  );
};
