'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Application, Member, CalculationParams, BenefitCalculationResult } from '@/types/database'
import { APPLICATION_STATUS } from '@/lib/constants/application-status'
import { calculateBenefit } from '@/lib/calculations/benefit-calculator'
import { getBenefitTypeName } from '@/lib/constants/benefit-types'
import { format } from 'date-fns'
import { createNotification } from '@/lib/actions/notifications'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateApplicationInput {
  memberId: string
  benefitTypeCode: string
  calculationParams: CalculationParams
  applicationContent?: Record<string, unknown>
}

interface CreateApplicationResult {
  success: true
  applicationId: string
  benefitResult: BenefitCalculationResult
}

interface CreateApplicationError {
  success: false
  error: string
}

interface ApplicationStats {
  pending: number
  companyApproved: number
  hqApproved: number
  paid: number
  rejected: number
  total: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateApplicationId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<string> {
  const now = new Date()
  const today = format(now, 'yyyyMMdd')
  const prefix = `AP${today}`

  // Use service role client to count all applications (bypasses RLS)
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { count } = await adminClient
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .like('application_id', `${prefix}%`)

  const seq = (count ?? 0) + 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * 申請一覧を取得する（フィルター付き）
 */
export async function getApplications(filters?: {
  status?: string
  companyCode?: string
  memberId?: string
  benefitTypeCode?: string
}): Promise<Application[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('applications')
    .select('*')
    .order('application_date', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.companyCode) {
    query = query.eq('company_code', filters.companyCode)
  }
  if (filters?.memberId) {
    query = query.eq('member_id', filters.memberId)
  }
  if (filters?.benefitTypeCode) {
    query = query.eq('benefit_type_code', filters.benefitTypeCode)
  }

  const { data, error } = await query

  if (error) {
    console.error('申請一覧の取得に失敗しました:', error.message)
    return []
  }

  return (data ?? []) as Application[]
}

/**
 * 申請詳細を取得する
 */
export async function getApplication(applicationId: string): Promise<Application | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('application_id', applicationId)
    .single()

  if (error) {
    console.error('申請の取得に失敗しました:', error.message)
    return null
  }

  return data as Application
}

/**
 * 新規申請を作成する
 */
export async function createApplication(
  input: CreateApplicationInput
): Promise<CreateApplicationResult | CreateApplicationError> {
  const supabase = await createServerSupabaseClient()

  try {
    // 1. 会員情報を取得
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('member_id', input.memberId)
      .single()

    if (memberError || !member) {
      return { success: false, error: '会員情報が見つかりません' }
    }

    const typedMember = member as Member

    // 2. 給付金を計算
    const benefitResult = calculateBenefit(
      input.benefitTypeCode,
      input.calculationParams,
      typedMember
    )

    // 3. 申請IDを生成（重複時はリトライ）
    const now = new Date().toISOString()
    const applicationDate = format(new Date(), 'yyyy-MM-dd')
    const benefitTypeName = getBenefitTypeName(input.benefitTypeCode)

    let applicationId = ''
    let insertError = null

    for (let attempt = 0; attempt < 5; attempt++) {
      applicationId = await generateApplicationId(supabase)

      const { error } = await supabase
        .from('applications')
        .insert({
          application_id: applicationId,
          application_date: applicationDate,
          member_id: typedMember.member_id,
          member_name: `${typedMember.last_name} ${typedMember.first_name}`,
          company_code: typedMember.company_code,
          company_name: typedMember.company_name,
          benefit_type_code: input.benefitTypeCode,
          benefit_type_name: benefitTypeName,
          application_content: input.applicationContent ?? null,
          attachments: null,
          calculation_base_date: applicationDate,
          membership_years: benefitResult.membershipYears ?? null,
          standard_monthly_remuneration: benefitResult.standardMonthlyRemuneration ?? null,
          calculated_amount: benefitResult.amount,
          final_amount: benefitResult.amount,
          status: APPLICATION_STATUS.PENDING,
          company_approver: null,
          company_approval_date: null,
          company_comment: null,
          hq_approver: null,
          hq_approval_date: null,
          hq_comment: null,
          scheduled_payment_date: null,
          payment_completed_date: null,
          created_at: now,
          updated_at: now,
        })

      if (!error) {
        insertError = null
        break
      }

      if (error.message.includes('duplicate key')) {
        insertError = error
        continue
      }

      // Other error - don't retry
      console.error('申請の作成に失敗しました:', error.message)
      return { success: false, error: `申請の作成に失敗しました: ${error.message}` }
    }

    if (insertError) {
      console.error('申請の作成に失敗しました:', insertError.message)
      return { success: false, error: '申請IDの生成に失敗しました。再度お試しください。' }
    }

    // 5. 監査ログを記録
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('audit_logs').insert({
      timestamp: now,
      user_email: user?.email ?? null,
      user_id: user?.id ?? null,
      operation_type: 'CREATE_APPLICATION',
      target: applicationId,
      details: `申請作成: ${benefitTypeName} - ${typedMember.last_name} ${typedMember.first_name} - ${benefitResult.amount.toLocaleString()}円`,
    })

    // 6. 該当会社の承認者に通知
    try {
      const { data: companyApprovers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('company_code', typedMember.company_code)
        .in('role', ['approver', 'admin'])
        .eq('is_active', true)
      for (const approver of companyApprovers ?? []) {
        await createNotification(
          approver.id,
          '新規申請',
          `${typedMember.last_name} ${typedMember.first_name}さんから${benefitTypeName}の申請がありました。`,
          'info',
          `/applications/${applicationId}`,
        )
      }
    } catch { /* 通知失敗は無視 */ }

    return {
      success: true,
      applicationId,
      benefitResult,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
    console.error('申請作成中にエラーが発生しました:', message)
    return { success: false, error: message }
  }
}

/**
 * 申請のステータス別集計を取得する
 */
export async function getApplicationStats(companyCode?: string): Promise<ApplicationStats> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('applications')
    .select('status')

  if (companyCode) {
    query = query.eq('company_code', companyCode)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('申請統計の取得に失敗しました:', error?.message)
    return {
      pending: 0,
      companyApproved: 0,
      hqApproved: 0,
      paid: 0,
      rejected: 0,
      total: 0,
    }
  }

  const stats: ApplicationStats = {
    pending: 0,
    companyApproved: 0,
    hqApproved: 0,
    paid: 0,
    rejected: 0,
    total: data.length,
  }

  for (const row of data) {
    switch (row.status) {
      case APPLICATION_STATUS.PENDING:
        stats.pending++
        break
      case APPLICATION_STATUS.COMPANY_APPROVED:
        stats.companyApproved++
        break
      case APPLICATION_STATUS.HQ_APPROVED:
        stats.hqApproved++
        break
      case APPLICATION_STATUS.PAID:
        stats.paid++
        break
      case APPLICATION_STATUS.REJECTED:
        stats.rejected++
        break
    }
  }

  return stats
}
