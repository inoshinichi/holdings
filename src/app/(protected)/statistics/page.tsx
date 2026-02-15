import { getBenefitStatistics } from '@/lib/actions/reports'
import { StatisticsClient } from '@/components/statistics/statistics-client'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserProfile } from '@/types/database'

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
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

  const now = new Date()
  const defaultStart = `${now.getFullYear()}-01-01`
  const defaultEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const startDate = params.startDate ?? defaultStart
  const endDate = params.endDate ?? defaultEnd

  const statistics = await getBenefitStatistics(startDate, endDate, companyCode)

  return (
    <StatisticsClient
      initialData={statistics}
      initialStartDate={startDate}
      initialEndDate={endDate}
      companyCode={companyCode}
    />
  )
}
