import { ValidationsQueuePage } from './ValidationsQueuePage'

export function PendingCompaniesPage() {
  return (
    <ValidationsQueuePage
      ownerType="COMPANY"
      heroKicker="Validation queue"
      heroTitle="Pending companies"
      heroSubtitle="Company verification requests from business representatives. Review legal identity, documents, and service context before approval."
    />
  )
}
