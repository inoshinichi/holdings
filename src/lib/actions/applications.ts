'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Application, Member, CalculationParams, BenefitCalculationResult } from '@/types/database'
import { APPLICATION_STATUS } from '@/lib/constants/application-status'
import { calculateBenefit } from '@/lib/calculations/benefit-calculator'
import { getBenefitTypeName } from '@/lib/constants/benefit-types'
import { format } from 'date-fns'
import { createNotification } from '@/lib/actions/notifications'
import { requireAuth, requireRole, getClientIP } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'

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
  try {
    const { supabase, profile } = await requireAuth()

    const effectiveFilters = { ...filters }

    // If member: force memberId filter to own member_id
    if (profile.role === 'member') {
      effectiveFilters.memberId = profile.member_id ?? undefined
    }

    // If approver: force companyCode to own company
    if (profile.role === 'approver') {
      effectiveFilters.companyCode = profile.company_code ?? undefined
    }

    let query = supabase
      .from('applications')
      .select('*')
      .order('application_date', { ascending: false })

    if (effectiveFilters?.status) {
      query = query.eq('status', effectiveFilters.status)
    }
    if (effectiveFilters?.companyCode) {
      query = query.eq('company_code', effectiveFilters.companyCode)
    }
    if (effectiveFilters?.memberId) {
      query = query.eq('member_id', effectiveFilters.memberId)
    }
    if (effectiveFilters?.benefitTypeCode) {
      query = query.eq('benefit_type_code', effectiveFilters.benefitTypeCode)
    }

    const { data, error } = await query

    if (error) {
      console.error('申請一覧の取得に失敗しました:', error.message)
      return []
    }

    return (data ?? []) as Application[]
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return []
    }
    console.error('申請一覧の取得に失敗しました:', err)
    return []
  }
}

/**
 * 申請詳細を取得する
 */
export async function getApplication(applicationId: string): Promise<Application | null> {
  try {
    const { supabase, profile } = await requireAuth()

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', applicationId)
      .single()

    if (error) {
      console.error('申請の取得に失敗しました:', error.message)
      return null
    }

    const application = data as Application

    // If member: check app.member_id matches own member_id
    if (profile.role === 'member') {
      if (application.member_id !== profile.member_id) {
        return null
      }
    }

    // If approver: check app.company_code matches own company_code
    if (profile.role === 'approver') {
      if (application.company_code !== profile.company_code) {
        return null
      }
    }

    return application
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return null
    }
    console.error('申請の取得に失敗しました:', err)
    return null
  }
}

/**
 * 新規申請を作成する
 */
export async function createApplication(
  input: CreateApplicationInput
): Promise<CreateApplicationResult | CreateApplicationError> {
  try {
    const { supabase, user, profile } = await requireAuth()
    const ip = await getClientIP()

    // If member: check input.memberId matches own member_id
    if (profile.role === 'member') {
      if (input.memberId !== profile.member_id) {
        return { success: false, error: '他の会員の申請を作成する権限がありません' }
      }
    }

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

    // If approver: check member's company_code matches own company_code
    if (profile.role === 'approver') {
      if (typedMember.company_code !== profile.company_code) {
        return { success: false, error: 'この会社のデータにアクセスする権限がありません' }
      }
    }

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
    await supabase.from('audit_logs').insert({
      timestamp: now,
      user_email: user.email,
      user_id: user.id,
      ip_address: ip,
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
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    const message = err instanceof Error ? err.message : '不明なエラーが発生しました'
    console.error('申請作成中にエラーが発生しました:', message)
    return { success: false, error: message }
  }
}

/**
 * 申請のステータス別集計を取得する
 */
export async function getApplicationStats(companyCode?: string): Promise<ApplicationStats> {
  try {
    const { supabase, profile } = await requireRole(['admin', 'approver'])

    // If approver: force companyCode to own company
    const effectiveCompanyCode = profile.role === 'approver'
      ? (profile.company_code ?? undefined)
      : companyCode

    let query = supabase
      .from('applications')
      .select('status')

    if (effectiveCompanyCode) {
      query = query.eq('company_code', effectiveCompanyCode)
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
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        pending: 0,
        companyApproved: 0,
        hqApproved: 0,
        paid: 0,
        rejected: 0,
        total: 0,
      }
    }
    console.error('申請統計の取得に失敗しました:', err)
    return {
      pending: 0,
      companyApproved: 0,
      hqApproved: 0,
      paid: 0,
      rejected: 0,
      total: 0,
    }
  }
}
