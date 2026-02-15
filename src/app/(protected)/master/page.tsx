import { getCompanies, getApprovers, getBenefitTypes, getAuditLogs } from '@/lib/actions/master'
import { MasterClient } from '@/components/master/master-client'

export default async function MasterPage() {
  const [companies, approvers, benefitTypes, auditLogs] = await Promise.all([
    getCompanies(),
    getApprovers(),
    getBenefitTypes(),
    getAuditLogs(100),
  ])

  return (
    <MasterClient
      initialCompanies={companies}
      initialApprovers={approvers}
      initialBenefitTypes={benefitTypes}
      initialAuditLogs={auditLogs}
    />
  )
}
