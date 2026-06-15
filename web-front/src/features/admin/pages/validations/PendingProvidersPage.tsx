import { ValidationsQueuePage } from "./ValidationsQueuePage";

export function PendingProvidersPage() {
  return (
    <ValidationsQueuePage
      ownerType="PROVIDER"
      heroKicker="Validation queue"
      heroTitle="Pending providers"
      heroSubtitle="Provider verification requests. Review identity documents and service credentials before approval."
    />
  );
}
