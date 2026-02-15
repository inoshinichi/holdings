import { getCompanies, getApprovers, getBenefitTypes, getAuditLogs, getFeeSettings } from '@/lib/actions/master'
import { MasterClient } from '@/components/master/master-client'

export default async function MasterPage() {
  const [companies, approvers, benefitTypes, auditLogs, feeSettings] = await Promise.all([
    getCompanies(),
    getApprovers(),
    getBenefitTypes(),
    getAuditLogs(100),
    getFeeSettings(),
  ])

  return (
    <MasterClient
      initialCompanies={companies}
      initialApprovers={approvers}
      initialBenefitTypes={benefitTypes}
      initialAuditLogs={auditLogs}
      initialFeeSettings={feeSettings}
    />
  )
}
