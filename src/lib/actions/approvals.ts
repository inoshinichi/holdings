'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { APPLICATION_STATUS } from '@/lib/constants/application-status'
import { format } from 'date-fns'
import type { Application } from '@/types/database'
import { createNotification } from '@/lib/actions/notifications'

// ---------------------------------------------------------------------------
// 1. 各社承認 (Company-level approval)
// ---------------------------------------------------------------------------
export async function approveByCompany(
  applicationId: string,
  comment?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: '認証エラー: ログインしてください' }
    }
    const email = user.email ?? ''

    // Get application and verify status
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', applicationId)
      .single()

    if (fetchError || !application) {
      return { success: false, error: '申請が見つかりません' }
    }

    if (application.status !== APPLICATION_STATUS.PENDING) {
      return {
        success: false,
        error: `承認できません。現在のステータス: ${application.status}`,
      }
    }

    // Update application
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: APPLICATION_STATUS.COMPANY_APPROVED,
        company_approver: email,
        company_approval_date: now,
        company_comment: comment ?? null,
      })
      .eq('application_id', applicationId)

    if (updateError) {
      return { success: false, error: `更新エラー: ${updateError.message}` }
    }

    // Insert audit log
    await supabase.from('audit_logs').insert({
      user_email: email,
      user_id: user.id,
      operation_type: '各社承認',
      target: applicationId,
      details: comment
        ? `各社承認 コメント: ${comment}`
        : '各社承認',
    })

    // 本部承認者に通知
    try {
      const { data: hqApprovers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true)
      for (const approver of hqApprovers ?? []) {
        await createNotification(
          approver.id,
          '各社承認完了',
          `申請 ${applicationId}（${application.member_name}）が各社承認されました。本部承認をお願いします。`,
          'approval',
          `/applications/${applicationId}`,
        )
      }
    } catch { /* 通知失敗は無視 */ }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// 2. 本部承認 (HQ-level approval) + 自動支払レコード作成
// ---------------------------------------------------------------------------
export async function approveByHQ(
  applicationId: string,
  comment?: string,
  finalAmount?: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: '認証エラー: ログインしてください' }
    }
    const email = user.email ?? ''

    // Get application and verify status
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', applicationId)
      .single()

    if (fetchError || !application) {
      return { success: false, error: '申請が見つかりません' }
    }

    if (application.status !== APPLICATION_STATUS.COMPANY_APPROVED) {
      return {
        success: false,
        error: `本部承認できません。現在のステータス: ${application.status}`,
      }
    }

    // Determine final amount
    const resolvedAmount =
      finalAmount !== undefined ? finalAmount : application.calculated_amount

    const now = new Date().toISOString()

    // Update application
    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: APPLICATION_STATUS.HQ_APPROVED,
        hq_approver: email,
        hq_approval_date: now,
        hq_comment: comment ?? null,
        final_amount: resolvedAmount,
      })
      .eq('application_id', applicationId)

    if (updateError) {
      return { success: false, error: `更新エラー: ${updateError.message}` }
    }

    // Fetch member's bank details
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select(
        'bank_code, branch_code, account_type, account_number, account_holder'
      )
      .eq('member_id', application.member_id)
      .single()

    if (memberError) {
      // Bank details fetch failed but approval already succeeded — log warning
      console.warn(
        `会員の口座情報取得に失敗: ${memberError.message}`
      )
    }

    // Generate payment_id: PAYyyyyMMddHHmmss
    const paymentId = `PAY${format(new Date(), 'yyyyMMddHHmmss')}`

    // Insert payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        payment_id: paymentId,
        application_id: applicationId,
        member_id: application.member_id,
        member_name: application.member_name,
        company_code: application.company_code,
        benefit_type: application.benefit_type_name,
        payment_amount: resolvedAmount,
        payment_date: now,
        bank_code: member?.bank_code ?? null,
        branch_code: member?.branch_code ?? null,
        account_type: member?.account_type ?? null,
        account_number: member?.account_number ?? null,
        account_holder: member?.account_holder ?? null,
      })

    if (paymentError) {
      return {
        success: false,
        error: `支払レコード作成エラー: ${paymentError.message}`,
      }
    }

    // Insert audit log
    await supabase.from('audit_logs').insert({
      user_email: email,
      user_id: user.id,
      operation_type: '本部承認',
      target: applicationId,
      details: comment
        ? `本部承認 最終金額: ${resolvedAmount} コメント: ${comment}`
        : `本部承認 最終金額: ${resolvedAmount}`,
    })

    // 申請会員に通知
    try {
      const { data: memberProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('member_id', application.member_id)
        .single()
      if (memberProfile) {
        await createNotification(
          memberProfile.id,
          '本部承認完了',
          `申請 ${applicationId}（${application.benefit_type_name}）が本部承認されました。`,
          'approval',
          `/applications/${applicationId}`,
        )
      }
    } catch { /* 通知失敗は無視 */ }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// 3. 差戻し (Reject / Send-back)
// ---------------------------------------------------------------------------
export async function rejectApplication(
  applicationId: string,
  reason: string,
  level?: 'company' | 'hq'
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: '認証エラー: ログインしてください' }
    }
    const email = user.email ?? ''

    // Get application
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', applicationId)
      .single()

    if (fetchError || !application) {
      return { success: false, error: '申請が見つかりません' }
    }

    // Build the comment with prefix
    const commentText = `【差戻し】${reason}`

    // Determine which comment field to set based on level
    const commentField =
      level === 'hq' ? 'hq_comment' : 'company_comment'

    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: APPLICATION_STATUS.REJECTED,
        [commentField]: commentText,
      })
      .eq('application_id', applicationId)

    if (updateError) {
      return { success: false, error: `更新エラー: ${updateError.message}` }
    }

    // Insert audit log
    await supabase.from('audit_logs').insert({
      user_email: email,
      user_id: user.id,
      operation_type: '差戻し',
      target: applicationId,
      details: `${level === 'hq' ? '本部' : '各社'}差戻し 理由: ${reason}`,
    })

    // 申請会員に通知
    try {
      const { data: memberProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('member_id', application.member_id)
        .single()
      if (memberProfile) {
        await createNotification(
          memberProfile.id,
          '申請が差戻しされました',
          `申請 ${applicationId}（${application.benefit_type_name}）が差戻しされました。理由: ${reason}`,
          'rejected',
          `/applications/${applicationId}`,
        )
      }
    } catch { /* 通知失敗は無視 */ }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// 4. 支払完了 (Mark as paid)
// ---------------------------------------------------------------------------
export async function markAsPaid(
  applicationId: string,
  paymentDate?: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: '認証エラー: ログインしてください' }
    }
    const email = user.email ?? ''

    // Get application and verify status
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select('*')
      .eq('application_id', applicationId)
      .single()

    if (fetchError || !application) {
      return { success: false, error: '申請が見つかりません' }
    }

    if (application.status !== APPLICATION_STATUS.HQ_APPROVED) {
      return {
        success: false,
        error: `支払完了にできません。現在のステータス: ${application.status}`,
      }
    }

    const completedDate = paymentDate ?? new Date().toISOString()

    const { error: updateError } = await supabase
      .from('applications')
      .update({
        status: APPLICATION_STATUS.PAID,
        payment_completed_date: completedDate,
      })
      .eq('application_id', applicationId)

    if (updateError) {
      return { success: false, error: `更新エラー: ${updateError.message}` }
    }

    // Insert audit log
    await supabase.from('audit_logs').insert({
      user_email: email,
      user_id: user.id,
      operation_type: '支払完了',
      target: applicationId,
      details: `支払完了 支払日: ${completedDate}`,
    })

    // 申請会員に通知
    try {
      const { data: memberProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('member_id', application.member_id)
        .single()
      if (memberProfile) {
        await createNotification(
          memberProfile.id,
          '支払が完了しました',
          `申請 ${applicationId}（${application.benefit_type_name}）の支払が完了しました。`,
          'paid',
          `/applications/${applicationId}`,
        )
      }
    } catch { /* 通知失敗は無視 */ }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// 5. 承認待ち一覧取得 (Get pending approvals)
// ---------------------------------------------------------------------------
export async function getPendingApprovals(
  level: 'company' | 'hq',
  companyCode?: string
): Promise<Application[]> {
  try {
    const supabase = await createServerSupabaseClient()

    // Determine which status to filter on
    const targetStatus =
      level === 'company'
        ? APPLICATION_STATUS.PENDING
        : APPLICATION_STATUS.COMPANY_APPROVED

    let query = supabase
      .from('applications')
      .select('*')
      .eq('status', targetStatus)

    if (companyCode) {
      query = query.eq('company_code', companyCode)
    }

    query = query.order('application_date', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('承認待ち一覧取得エラー:', error.message)
      return []
    }

    return (data ?? []) as Application[]
  } catch (err) {
    console.error('承認待ち一覧取得エラー:', err)
    return []
  }
}
