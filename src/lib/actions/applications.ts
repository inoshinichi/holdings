'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Application, Member, CalculationParams, BenefitCalculationResult } from '@/types/database'
import { APPLICATION_STATUS } from '@/lib/constants/application-status'
import { calculateBenefit } from '@/lib/calculations/benefit-calculator'
import { getBenefitTypeName } from '@/lib/constants/benefit-types'
import { format } from 'date-fns'

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
  const today = format(new Date(), 'yyyyMMdd')
  const prefix = `AP${today}`

  const { data } = await supabase
    .from('applications')
    .select('application_id')
    .like('application_id', `${prefix}%`)
    .order('application_id', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return `${prefix}0001`

  const lastSeq = parseInt(data[0].application_id.slice(-4), 10)
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
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

    // 3. 申請IDを生成
    const applicationId = await generateApplicationId(supabase)

    // 4. 申請レコードを挿入
    const now = new Date().toISOString()
    const applicationDate = format(new Date(), 'yyyy-MM-dd')
    const benefitTypeName = getBenefitTypeName(input.benefitTypeCode)

    const { error: insertError } = await supabase
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

    if (insertError) {
      console.error('申請の作成に失敗しました:', insertError.message)
      return { success: false, error: `申請の作成に失敗しました: ${insertError.message}` }
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
export async function getApplicationStats(): Promise<ApplicationStats> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('applications')
    .select('status')

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
