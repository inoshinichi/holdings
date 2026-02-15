'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MonthlyFee } from '@/types/database'
import { getFeeAmount } from '@/lib/constants/fee-categories'

// ---------------------------------------------------------------------------
// 1. generateMonthlyFees – 月次会費データの一括生成
// ---------------------------------------------------------------------------
export async function generateMonthlyFees(yearMonth: string): Promise<
  { success: true; companyCount: number } | { success: false; error: string }
> {
  try {
    const supabase = await createServerSupabaseClient()

    // Fetch all members who are either 在職中 or 休会中
    const { data: members, error: memberError } = await supabase
      .from('members')
      .select('company_code, company_name, fee_category, employment_status')
      .in('employment_status', ['在職中', '休会中'])

    if (memberError) {
      return { success: false, error: memberError.message }
    }

    if (!members || members.length === 0) {
      return { success: false, error: '対象の会員が見つかりません' }
    }

    // Group members by company_code
    const companyMap = new Map<
      string,
      {
        company_name: string
        general_count: number
        chief_count: number
        manager_count: number
        leave_count: number
      }
    >()

    for (const m of members) {
      const code = m.company_code as string
      if (!companyMap.has(code)) {
        companyMap.set(code, {
          company_name: m.company_name as string,
          general_count: 0,
          chief_count: 0,
          manager_count: 0,
          leave_count: 0,
        })
      }

      const entry = companyMap.get(code)!

      if (m.employment_status === '休会中') {
        entry.leave_count += 1
      } else {
        // 在職中 – classify by fee_category
        switch (m.fee_category) {
          case '係長以上':
            entry.chief_count += 1
            break
          case '部長職以上':
            entry.manager_count += 1
            break
          default:
            // 一般社員 or fallback
            entry.general_count += 1
            break
        }
      }
    }

    // Delete existing records for this year_month (upsert approach)
    const { error: deleteError } = await supabase
      .from('monthly_fees')
      .delete()
      .eq('year_month', yearMonth)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    // DBから会費設定を取得（フォールバック付き）
    const { data: feeSettingsData } = await supabase
      .from('fee_settings')
      .select('category, amount')
    const feeMap: Record<string, number> = {}
    for (const fs of feeSettingsData ?? []) {
      feeMap[fs.category as string] = fs.amount as number
    }
    const getAmount = (cat: string) => feeMap[cat] ?? getFeeAmount(cat)

    // Build rows to insert
    const rows = Array.from(companyMap.entries()).map(([companyCode, c]) => {
      const totalFee =
        c.general_count * getAmount('一般社員') +
        c.chief_count * getAmount('係長以上') +
        c.manager_count * getAmount('部長職以上')

      return {
        year_month: yearMonth,
        company_code: companyCode,
        company_name: c.company_name,
        member_count: c.general_count + c.chief_count + c.manager_count,
        general_count: c.general_count,
        chief_count: c.chief_count,
        manager_count: c.manager_count,
        leave_count: c.leave_count,
        total_fee: totalFee,
        status: '未請求' as const,
      }
    })

    const { error: insertError } = await supabase
      .from('monthly_fees')
      .insert(rows)

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // Audit log
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      operation_type: '会費データ生成',
      target: `monthly_fees:${yearMonth}`,
      details: `${yearMonth} の会費データを生成しました。対象企業数: ${rows.length}`,
    })

    return { success: true, companyCount: rows.length }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラーが発生しました',
    }
  }
}

// ---------------------------------------------------------------------------
// 2. getFees – 会費一覧取得（フィルタ付き）
// ---------------------------------------------------------------------------
export async function getFees(filters?: {
  yearMonth?: string
  companyCode?: string
  status?: string
}): Promise<MonthlyFee[]> {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('monthly_fees')
    .select('*')
    .order('year_month', { ascending: false })
    .order('company_code', { ascending: true })

  if (filters?.yearMonth) {
    query = query.eq('year_month', filters.yearMonth)
  }
  if (filters?.companyCode) {
    query = query.eq('company_code', filters.companyCode)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('getFees error:', error.message)
    return []
  }

  return (data ?? []) as MonthlyFee[]
}

// ---------------------------------------------------------------------------
// 3. recordFeePayment – 入金記録
// ---------------------------------------------------------------------------
export async function recordFeePayment(
  id: string,
  amount: number,
  paymentDate?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Fetch existing fee record
    const { data: fee, error: fetchError } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !fee) {
      return { success: false, error: fetchError?.message ?? '会費レコードが見つかりません' }
    }

    const totalFee = (fee as MonthlyFee).total_fee
    const status: string = amount >= totalFee ? '入金完了' : '一部入金'
    const resolvedPaymentDate =
      paymentDate ?? new Date().toISOString().slice(0, 10)

    const { error: updateError } = await supabase
      .from('monthly_fees')
      .update({
        paid_amount: amount,
        payment_date: resolvedPaymentDate,
        status,
      })
      .eq('id', id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Audit log
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      operation_type: '入金記録',
      target: `monthly_fees:${id}`,
      details: `入金額: ${amount}, 入金日: ${resolvedPaymentDate}, ステータス: ${status}`,
    })

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラーが発生しました',
    }
  }
}

// ---------------------------------------------------------------------------
// 4. markFeesAsInvoiced – 請求済みに更新
// ---------------------------------------------------------------------------
export async function markFeesAsInvoiced(
  ids: string[],
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    const today = new Date().toISOString().slice(0, 10)

    const { error: updateError } = await supabase
      .from('monthly_fees')
      .update({
        status: '請求済',
        invoice_date: today,
      })
      .in('id', ids)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '不明なエラーが発生しました',
    }
  }
}

// ---------------------------------------------------------------------------
// 5. getFeeSummary – 月次会費サマリ
// ---------------------------------------------------------------------------
export async function getFeeSummary(yearMonth: string): Promise<{
  yearMonth: string
  totalCompanies: number
  totalMembers: number
  totalFee: number
  paidAmount: number
  unpaidAmount: number
  paidCompanies: number
  unpaidCompanies: number
}> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('monthly_fees')
    .select('*')
    .eq('year_month', yearMonth)

  if (error || !data) {
    return {
      yearMonth,
      totalCompanies: 0,
      totalMembers: 0,
      totalFee: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      paidCompanies: 0,
      unpaidCompanies: 0,
    }
  }

  const fees = data as MonthlyFee[]

  const totalCompanies = fees.length
  const totalMembers = fees.reduce((sum, f) => sum + f.member_count, 0)
  const totalFee = fees.reduce((sum, f) => sum + f.total_fee, 0)
  const paidAmount = fees.reduce((sum, f) => sum + (f.paid_amount ?? 0), 0)
  const unpaidAmount = totalFee - paidAmount
  const paidCompanies = fees.filter((f) => f.status === '入金完了').length
  const unpaidCompanies = totalCompanies - paidCompanies

  return {
    yearMonth,
    totalCompanies,
    totalMembers,
    totalFee,
    paidAmount,
    unpaidAmount,
    paidCompanies,
    unpaidCompanies,
  }
}
