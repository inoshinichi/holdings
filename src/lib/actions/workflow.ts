'use server'

import type { Approver, Company } from '@/types/database'
import { requireRole, getClientIP } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'

/**
 * Get all workflow assignments (companies with their approvers)
 */
export async function getWorkflowAssignments(): Promise<{
  companies: Company[]
  approvers: Approver[]
}> {
  try {
    const { supabase } = await requireRole(['admin'])

    const [companiesResult, approversResult] = await Promise.all([
      supabase.from('companies').select('*').eq('is_active', true).order('company_code'),
      supabase.from('approvers').select('*').eq('is_active', true).order('company_code'),
    ])

    return {
      companies: (companiesResult.data ?? []) as Company[],
      approvers: (approversResult.data ?? []) as Approver[],
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { companies: [], approvers: [] }
    }
    throw err
  }
}

/**
 * Update company's assigned approver
 */
export async function assignCompanyApprover(
  companyCode: string,
  approverId: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireRole(['admin'])
    const ip = await getClientIP()

    const { error } = await supabase
      .from('companies')
      .update({ approver_id: approverId })
      .eq('company_code', companyCode)

    if (error) return { success: false, error: error.message }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      operation_type: '承認者割当',
      target: companyCode,
      details: `承認者ID: ${approverId || '未設定'}`,
      ip_address: ip,
    })

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}
