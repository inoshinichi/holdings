import { getBenefitStatistics } from '@/lib/actions/reports'
import { StatisticsClient } from '@/components/statistics/statistics-client'

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams

  const now = new Date()
  const defaultStart = `${now.getFullYear()}-01-01`
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const startDate = params.startDate ?? defaultStart
  const endDate = params.endDate ?? defaultEnd

  const statistics = await getBenefitStatistics(startDate, endDate)

  return (
    <StatisticsClient
      initialData={statistics}
      initialStartDate={startDate}
      initialEndDate={endDate}
    />
  )
}
