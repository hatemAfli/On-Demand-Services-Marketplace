import { ValidationsQueuePage } from './ValidationsQueuePage'

export function PendingProvidersPage() {
  return (
    <ValidationsQueuePage
      ownerType="PROVIDER"
      heroKicker="Validation queue"
      heroTitle="Pending providers"
      heroSubtitle="Independent and employee providers waiting for profile verification. Open a row to review documents, mark under review, approve, or reject."
    />
  )
}
