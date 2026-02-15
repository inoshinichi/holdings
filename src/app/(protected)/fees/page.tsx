import { getFees, getFeeSummary } from '@/lib/actions/fees'
import { formatYearMonth } from '@/lib/utils/date'
import { FeesClient } from '@/components/fees/fees-client'

interface FeesPageProps {
  searchParams: Promise<{ yearMonth?: string }>
}

export default async function FeesPage({ searchParams }: FeesPageProps) {
  const params = await searchParams
  const yearMonth = params.yearMonth ?? formatYearMonth(new Date())

  const [fees, summary] = await Promise.all([
    getFees({ yearMonth }),
    getFeeSummary(yearMonth),
  ])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">会費管理</h2>
      <FeesClient
        fees={fees}
        summary={summary}
        currentYearMonth={yearMonth}
      />
    </div>
  )
}
