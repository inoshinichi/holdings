'use server'

import type { Payment } from '@/types/database'
import { requireRole, getClientIP } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentStats {
  totalCount: number
  pendingCount: number
  totalAmount: number
  pendingAmount: number
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * 支払い一覧を取得する（フィルタ付き）
 */
export async function getPayments(
  filters?: {
    companyCode?: string
    exported?: boolean
  },
): Promise<Payment[]> {
  try {
    const { supabase } = await requireRole(['admin'])

    let query = supabase.from('payments').select('*')

    if (filters?.companyCode) {
      query = query.eq('company_code', filters.companyCode)
    }

    if (filters?.exported === true) {
      query = query.not('zengin_export_date', 'is', null)
    } else if (filters?.exported === false) {
      query = query.is('zengin_export_date', null)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('getPayments error:', error.message)
      return []
    }

    return (data ?? []) as Payment[]
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return []
    }
    throw err
  }
}

/**
 * 全銀CSV未出力の支払いを取得する
 */
export async function getPendingPayments(): Promise<Payment[]> {
  try {
    const { supabase } = await requireRole(['admin'])

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .is('zengin_export_date', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('getPendingPayments error:', error.message)
      return []
    }

    return (data ?? []) as Payment[]
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return []
    }
    throw err
  }
}

/**
 * 支払いを全銀CSV出力済みとしてマークする
 */
export async function markPaymentsAsExported(
  paymentIds: string[],
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { supabase, user } = await requireRole(['admin'])
    const ip = await getClientIP()

    if (paymentIds.length === 0) {
      return { success: false, error: '支払いIDが指定されていません' }
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({ zengin_export_date: new Date().toISOString() })
      .in('payment_id', paymentIds)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 監査ログを記録
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      operation_type: '全銀CSV出力',
      target: `payments: ${paymentIds.length}件`,
      details: `対象payment_id: ${paymentIds.join(', ')}`,
      ip_address: ip,
    })

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    const message =
      err instanceof Error ? err.message : '全銀CSV出力処理中にエラーが発生しました'
    return { success: false, error: message }
  }
}

/**
 * 支払い統計を取得する
 */
export async function getPaymentStats(): Promise<PaymentStats> {
  try {
    const { supabase } = await requireRole(['admin'])

    // 全件数と未出力件数を並列で取得
    const [totalResult, pendingResult, allPayments, pendingPayments] =
      await Promise.all([
        supabase
          .from('payments')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .is('zengin_export_date', null),
        supabase
          .from('payments')
          .select('payment_amount'),
        supabase
          .from('payments')
          .select('payment_amount')
          .is('zengin_export_date', null),
      ])

    const totalAmount = (allPayments.data ?? []).reduce(
      (sum, row) => sum + (row.payment_amount ?? 0),
      0,
    )

    const pendingAmount = (pendingPayments.data ?? []).reduce(
      (sum, row) => sum + (row.payment_amount ?? 0),
      0,
    )

    return {
      totalCount: totalResult.count ?? 0,
      pendingCount: pendingResult.count ?? 0,
      totalAmount,
      pendingAmount,
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return {
        totalCount: 0,
        pendingCount: 0,
        totalAmount: 0,
        pendingAmount: 0,
      }
    }
    throw err
  }
}
