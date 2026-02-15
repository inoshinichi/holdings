'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Company, Approver, BenefitType, AuditLog } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  operationType: string,
  target: string | null,
  details: string | null,
) {
  const userEmail = (await supabase.auth.getUser()).data.user?.email ?? null
  await supabase.from('audit_logs').insert({
    user_email: userEmail,
    operation_type: operationType,
    target,
    details,
  })
}

// ---------------------------------------------------------------------------
// 会社マスター (Companies)
// ---------------------------------------------------------------------------

/**
 * 会社一覧を取得する
 */
export async function getCompanies(): Promise<Company[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('company_code', { ascending: true })

  if (error) {
    console.error('getCompanies error:', error.message)
    return []
  }

  return (data ?? []) as Company[]
}

/**
 * 単一会社を取得する
 */
export async function getCompany(companyCode: string): Promise<Company | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('company_code', companyCode)
    .single()

  if (error) {
    console.error('getCompany error:', error.message)
    return null
  }

  return data as Company
}

/**
 * 会社を登録・更新する（upsert）
 */
export async function upsertCompany(
  data: Partial<Company> & { company_code: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  try {
    const { error: upsertError } = await supabase
      .from('companies')
      .upsert(data, { onConflict: 'company_code' })

    if (upsertError) {
      return { success: false, error: upsertError.message }
    }

    await writeAuditLog(
      supabase,
      '会社マスター更新',
      data.company_code,
      `会社コード: ${data.company_code}${data.company_name ? `, 会社名: ${data.company_name}` : ''}`,
    )

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '会社マスター更新中にエラーが発生しました'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// 承認者マスター (Approvers)
// ---------------------------------------------------------------------------

/**
 * 承認者一覧を取得する（会社コードでフィルタ可能）
 */
export async function getApprovers(companyCode?: string): Promise<Approver[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase.from('approvers').select('*')

  if (companyCode) {
    query = query.eq('company_code', companyCode)
  }

  query = query
    .order('company_code', { ascending: true })
    .order('approver_id', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('getApprovers error:', error.message)
    return []
  }

  return (data ?? []) as Approver[]
}

/**
 * 承認者を登録・更新する（upsert）
 */
export async function upsertApprover(
  data: Partial<Approver> & { approver_id: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  try {
    const { error: upsertError } = await supabase
      .from('approvers')
      .upsert(data, { onConflict: 'approver_id' })

    if (upsertError) {
      return { success: false, error: upsertError.message }
    }

    await writeAuditLog(
      supabase,
      '承認者マスター更新',
      data.approver_id,
      `承認者ID: ${data.approver_id}${data.full_name ? `, 氏名: ${data.full_name}` : ''}`,
    )

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '承認者マスター更新中にエラーが発生しました'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// 給付金マスター (Benefit Types)
// ---------------------------------------------------------------------------

/**
 * 給付金種別一覧を取得する
 */
export async function getBenefitTypes(): Promise<BenefitType[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('benefit_types')
    .select('*')
    .order('benefit_type_code', { ascending: true })

  if (error) {
    console.error('getBenefitTypes error:', error.message)
    return []
  }

  return (data ?? []) as BenefitType[]
}

// ---------------------------------------------------------------------------
// 監査ログ (Audit Logs)
// ---------------------------------------------------------------------------

/**
 * 監査ログを取得する（直近N件）
 */
export async function getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getAuditLogs error:', error.message)
    return []
  }

  return (data ?? []) as AuditLog[]
}
