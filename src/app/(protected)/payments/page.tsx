import { getPayments, getPaymentStats } from '@/lib/actions/payments'
import { PaymentsClient } from '@/components/payments/payments-client'

export default async function PaymentsPage() {
  const [stats, payments] = await Promise.all([
    getPaymentStats(),
    getPayments(),
  ])

  return <PaymentsClient initialStats={stats} initialPayments={payments} />
}
