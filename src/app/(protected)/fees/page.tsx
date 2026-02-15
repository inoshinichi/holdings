import { getFees, getFeeSummary } from '@/lib/actions/fees'
import { formatYearMonth } from '@/lib/utils/date'
import { FeesClient } from '@/components/fees/fees-client'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserProfile } from '@/types/database'

interface FeesPageProps {
  searchParams: Promise<{ yearMonth?: string }>
}

export default async function FeesPage({ searchParams }: FeesPageProps) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_code')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  const typedProfile = profile as Pick<UserProfile, 'role' | 'company_code'>
  const isApprover = typedProfile.role === 'approver'
  const companyCode = isApprover ? (typedProfile.company_code ?? undefined) : undefined

  const params = await searchParams
  const yearMonth = params.yearMonth ?? formatYearMonth(new Date())

  const [fees, summary] = await Promise.all([
    getFees({ yearMonth, companyCode }),
    getFeeSummary(yearMonth, companyCode),
  ])

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">会費管理</h2>
      <FeesClient
        fees={fees}
        summary={summary}
        currentYearMonth={yearMonth}
        readOnly={isApprover}
      />
    </div>
  )
}
