import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getPendingApprovals } from '@/lib/actions/approvals'
import { ApprovalList } from '@/components/approvals/approval-list'
import type { UserRole } from '@/types/database'

export default async function ApprovalsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_code')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role as UserRole
  const companyCode = profile.company_code as string | null

  // Fetch pending approvals based on role
  // admin: can see both company-level and hq-level pending items
  // approver: company-level only, scoped to their company
  const companyApprovals = await getPendingApprovals(
    'company',
    role === 'approver' ? (companyCode ?? undefined) : undefined
  )

  const hqApprovals = role === 'admin'
    ? await getPendingApprovals('hq')
    : []

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">承認管理</h2>
      <ApprovalList
        companyApprovals={companyApprovals}
        hqApprovals={hqApprovals}
        userRole={role}
      />
    </div>
  )
}
