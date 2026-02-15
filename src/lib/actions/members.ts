'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Member, FeeCategory } from '@/types/database'
import { getFeeAmount } from '@/lib/constants/fee-categories'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterMemberInput {
  memberId?: string
  companyCode: string
  companyName: string
  lastName: string
  firstName: string
  lastNameKana?: string
  firstNameKana?: string
  birthDate?: string
  gender?: string
  email?: string
  enrollmentDate: string
  employmentType?: string
  positionCategory?: string
  feeCategory: FeeCategory
  standardMonthlyRemuneration?: number
  bankCode?: string
  bankName?: string
  branchCode?: string
  branchName?: string
  accountType?: string
  accountNumber?: string
  accountHolder?: string
}

export interface MemberStats {
  total: number
  active: number
  onLeave: number
  withdrawn: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateMemberId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  companyCode: string,
): Promise<string> {
  const { data } = await supabase
    .from('members')
    .select('member_id')
    .like('member_id', `${companyCode}-%`)
    .order('member_id', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return `${companyCode}-00001`

  const lastNum = parseInt(data[0].member_id.split('-')[1], 10)
  return `${companyCode}-${String(lastNum + 1).padStart(5, '0')}`
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * 会員一覧を取得する（フィルタ付き）
 */
export async function getMembers(
  filters?: {
    companyCode?: string
    status?: string
    feeCategory?: string
  },
): Promise<Member[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase.from('members').select('*')

  if (filters?.companyCode) {
    query = query.eq('company_code', filters.companyCode)
  }
  if (filters?.status) {
    query = query.eq('employment_status', filters.status)
  }
  if (filters?.feeCategory) {
    query = query.eq('fee_category', filters.feeCategory)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('getMembers error:', error.message)
    return []
  }

  return (data ?? []) as Member[]
}

/**
 * 単一会員を取得する
 */
export async function getMember(memberId: string, companyCode?: string): Promise<Member | null> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('members')
    .select('*')
    .eq('member_id', memberId)

  if (companyCode) {
    query = query.eq('company_code', companyCode)
  }

  const { data, error } = await query.single()

  if (error) {
    console.error('getMember error:', error.message)
    return null
  }

  return data as Member
}

/**
 * 新規会員を登録する
 */
export async function registerMember(
  data: RegisterMemberInput,
): Promise<{ success: true; memberId: string } | { success: false; error: string }> {
  const supabase = await createServerSupabaseClient()

  try {
    // 会員IDが指定されていればそれを使い、なければ自動発番
    let memberId: string
    if (data.memberId?.trim()) {
      // 重複チェック
      const { data: existing } = await supabase
        .from('members')
        .select('member_id')
        .eq('member_id', data.memberId.trim())
        .single()
      if (existing) {
        return { success: false, error: `会員ID「${data.memberId.trim()}」は既に使用されています` }
      }
      memberId = data.memberId.trim()
    } else {
      memberId = await generateMemberId(supabase, data.companyCode)
    }
    const feeAmount = getFeeAmount(data.feeCategory)

    const { error: insertError } = await supabase.from('members').insert({
      member_id: memberId,
      company_code: data.companyCode,
      company_name: data.companyName,
      last_name: data.lastName,
      first_name: data.firstName,
      last_name_kana: data.lastNameKana ?? null,
      first_name_kana: data.firstNameKana ?? null,
      birth_date: data.birthDate ?? null,
      gender: data.gender ?? null,
      email: data.email ?? null,
      enrollment_date: data.enrollmentDate,
      employment_status: '在職中',
      employment_type: data.employmentType ?? null,
      position_category: data.positionCategory ?? null,
      fee_category: data.feeCategory,
      fee_amount: feeAmount,
      standard_monthly_remuneration: data.standardMonthlyRemuneration ?? null,
      bank_code: data.bankCode ?? null,
      bank_name: data.bankName ?? null,
      branch_code: data.branchCode ?? null,
      branch_name: data.branchName ?? null,
      account_type: data.accountType ?? null,
      account_number: data.accountNumber ?? null,
      account_holder: data.accountHolder ?? null,
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // 監査ログを記録
    const userEmail = (await supabase.auth.getUser()).data.user?.email
    await supabase.from('audit_logs').insert({
      user_email: userEmail,
      operation_type: '会員登録',
      target: memberId,
      details: `${data.lastName} ${data.firstName}`,
    })

    return { success: true, memberId }
  } catch (err) {
    const message = err instanceof Error ? err.message : '会員登録中にエラーが発生しました'
    return { success: false, error: message }
  }
}

/**
 * 会員情報を更新する
 */
export async function updateMember(
  memberId: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  try {
    const { error: updateError } = await supabase
      .from('members')
      .update(data)
      .eq('member_id', memberId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 監査ログを記録
    const userEmail = (await supabase.auth.getUser()).data.user?.email
    await supabase.from('audit_logs').insert({
      user_email: userEmail,
      operation_type: '会員更新',
      target: memberId,
      details: `更新フィールド: ${Object.keys(data).join(', ')}`,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '会員更新中にエラーが発生しました'
    return { success: false, error: message }
  }
}

/**
 * 会員を休会にする
 */
export async function setMemberOnLeave(
  memberId: string,
  startDate: string,
  endDate?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  try {
    const { error: updateError } = await supabase
      .from('members')
      .update({
        leave_start_date: startDate,
        leave_end_date: endDate ?? null,
        employment_status: '休会中',
      })
      .eq('member_id', memberId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 監査ログを記録
    const userEmail = (await supabase.auth.getUser()).data.user?.email
    await supabase.from('audit_logs').insert({
      user_email: userEmail,
      operation_type: '休会処理',
      target: memberId,
      details: `休会開始: ${startDate}${endDate ? `, 休会終了: ${endDate}` : ''}`,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '休会処理中にエラーが発生しました'
    return { success: false, error: message }
  }
}

/**
 * 会員を退会にする
 */
export async function withdrawMember(
  memberId: string,
  withdrawalDate: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

  try {
    const { error: updateError } = await supabase
      .from('members')
      .update({
        withdrawal_date: withdrawalDate,
        employment_status: '退会',
      })
      .eq('member_id', memberId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 監査ログを記録
    const userEmail = (await supabase.auth.getUser()).data.user?.email
    await supabase.from('audit_logs').insert({
      user_email: userEmail,
      operation_type: '退会処理',
      target: memberId,
      details: `退会日: ${withdrawalDate}`,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '退会処理中にエラーが発生しました'
    return { success: false, error: message }
  }
}

/**
 * 会員統計を取得する
 */
export async function getMemberStats(companyCode?: string): Promise<MemberStats> {
  const supabase = await createServerSupabaseClient()

  let totalQ = supabase.from('members').select('*', { count: 'exact', head: true })
  let activeQ = supabase.from('members').select('*', { count: 'exact', head: true }).eq('employment_status', '在職中')
  let onLeaveQ = supabase.from('members').select('*', { count: 'exact', head: true }).eq('employment_status', '休会中')
  let withdrawnQ = supabase.from('members').select('*', { count: 'exact', head: true }).eq('employment_status', '退会')

  if (companyCode) {
    totalQ = totalQ.eq('company_code', companyCode)
    activeQ = activeQ.eq('company_code', companyCode)
    onLeaveQ = onLeaveQ.eq('company_code', companyCode)
    withdrawnQ = withdrawnQ.eq('company_code', companyCode)
  }

  const [totalResult, activeResult, onLeaveResult, withdrawnResult] =
    await Promise.all([totalQ, activeQ, onLeaveQ, withdrawnQ])

  return {
    total: totalResult.count ?? 0,
    active: activeResult.count ?? 0,
    onLeave: onLeaveResult.count ?? 0,
    withdrawn: withdrawnResult.count ?? 0,
  }
}
