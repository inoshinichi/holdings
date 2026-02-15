import { getCompanies } from '@/lib/actions/master'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MemberForm } from '@/components/members/member-form'
import Link from 'next/link'
import type { UserProfile } from '@/types/database'

export default async function NewMemberPage() {
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

  let companies = await getCompanies()

  // approverの場合は自社のみ
  const lockedCompanyCode = typedProfile.role === 'approver' ? (typedProfile.company_code ?? undefined) : undefined
  if (lockedCompanyCode) {
    companies = companies.filter(c => c.company_code === lockedCompanyCode)
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/members" className="hover:text-blue-600 transition">
          会員一覧
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">新規会員登録</span>
      </div>

      <h2 className="text-xl font-bold text-gray-800">新規会員登録</h2>

      <MemberForm companies={companies} lockedCompanyCode={lockedCompanyCode} />
    </div>
  )
}
