'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Approver, Company } from '@/types/database'

/**
 * Get all workflow assignments (companies with their approvers)
 */
export async function getWorkflowAssignments(): Promise<{
  companies: Company[]
  approvers: Approver[]
}> {
  const supabase = await createServerSupabaseClient()

  const [companiesResult, approversResult] = await Promise.all([
    supabase.from('companies').select('*').eq('is_active', true).order('company_code'),
    supabase.from('approvers').select('*').eq('is_active', true).order('company_code'),
  ])

  return {
    companies: (companiesResult.data ?? []) as Company[],
    approvers: (approversResult.data ?? []) as Approver[],
  }
}

/**
 * Update company's assigned approver
 */
export async function assignCompanyApprover(
  companyCode: string,
  approverId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('companies')
    .update({ approver_id: approverId })
    .eq('company_code', companyCode)

  if (error) return { success: false, error: error.message }

  // Audit log
  const userEmail = (await supabase.auth.getUser()).data.user?.email
  await supabase.from('audit_logs').insert({
    user_email: userEmail,
    operation_type: '承認者割当',
    target: companyCode,
    details: `承認者ID: ${approverId || '未設定'}`,
  })

  return { success: true }
}
