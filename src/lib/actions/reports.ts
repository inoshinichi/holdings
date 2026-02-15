'use server'

import { requireRole } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'
import { BENEFIT_TYPE_LIST } from '@/lib/constants/benefit-types'
import { APPLICATION_STATUS } from '@/lib/constants/application-status'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardStats {
  members: { total: number; active: number; onLeave: number }
  applications: { pending: number; companyApproved: number; hqApproved: number; thisMonth: number }
  payments: { pendingCount: number; pendingAmount: number }
  fees: { currentMonth: string; totalFee: number; paidAmount: number }
}

interface BenefitStatistics {
  summary: { totalCount: number; totalAmount: number }
  byType: Array<{ code: string; name: string; count: number; amount: number; avgAmount: number }>
  byMonth: Array<{ month: string; count: number; amount: number }>
  byCompany: Array<{ companyCode: string; companyName: string; count: number; amount: number }>
}

interface MonthlyReportData {
  members: {
    total: number
    active: number
    onLeave: number
    newEnrollments: number
    withdrawals: number
  }
  fees: Array<{
    companyName: string
    memberCount: number
    invoiceAmount: number
    paidAmount: number
    status: string
  }>
  benefits: Array<{ name: string; count: number; amount: number }>
  applications: {
    pending: number
    companyApproved: number
    hqApproved: number
    paid: number
    rejected: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date as YYYY-MM (month string).
 */
function toMonthString(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/**
 * Get the first day and last day of a given YYYY-MM month.
 */
function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = `${yearMonth}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/**
 * Get current YYYY-MM string.
 */
function getCurrentYearMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function getToday(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Look up benefit type name by code using BENEFIT_TYPE_LIST.
 */
function benefitTypeName(code: string): string {
  const found = BENEFIT_TYPE_LIST.find((b) => b.code === code)
  return found?.name ?? '不明'
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * ダッシュボード統計情報を取得する（admin・approver専用）
 *
 * - 会員数 (全体・在職中・休会中)
 * - 申請件数 (ステータス別 + 当月申請数)
 * - 支払い情報 (未振込件数・金額)
 * - 当月会費情報
 *
 * approverの場合は自社のデータのみ表示する。
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const emptyStats: DashboardStats = {
    members: { total: 0, active: 0, onLeave: 0 },
    applications: { pending: 0, companyApproved: 0, hqApproved: 0, thisMonth: 0 },
    payments: { pendingCount: 0, pendingAmount: 0 },
    fees: { currentMonth: getCurrentYearMonth(), totalFee: 0, paidAmount: 0 },
  }

  try {
    const { supabase, profile } = await requireRole(['admin', 'approver'])

    const isApprover = profile.role === 'approver'
    const companyCode = profile.company_code

    const currentMonth = getCurrentYearMonth()
    const { start: monthStart, end: monthEnd } = getMonthRange(currentMonth)

    // ---- Members ----
    const buildMemberQuery = (extraFilter?: { key: string; value: string }) => {
      let q = supabase.from('members').select('*', { count: 'exact', head: true })
      if (isApprover && companyCode) q = q.eq('company_code', companyCode)
      if (extraFilter) q = q.eq(extraFilter.key, extraFilter.value)
      return q
    }

    const [totalRes, activeRes, onLeaveRes] = await Promise.all([
      buildMemberQuery(),
      buildMemberQuery({ key: 'employment_status', value: '在職中' }),
      buildMemberQuery({ key: 'employment_status', value: '休会中' }),
    ])

    // ---- Applications ----
    const buildAppCountQuery = (statusFilter?: string) => {
      let q = supabase.from('applications').select('*', { count: 'exact', head: true })
      if (isApprover && companyCode) q = q.eq('company_code', companyCode)
      if (statusFilter) q = q.eq('status', statusFilter)
      return q
    }

    const buildThisMonthQuery = () => {
      let q = supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${monthStart}T00:00:00`)
        .lte('created_at', `${monthEnd}T23:59:59`)
      if (isApprover && companyCode) q = q.eq('company_code', companyCode)
      return q
    }

    const [pendingRes, companyApprovedRes, hqApprovedRes, thisMonthRes] = await Promise.all([
      buildAppCountQuery(APPLICATION_STATUS.PENDING),
      buildAppCountQuery(APPLICATION_STATUS.COMPANY_APPROVED),
      buildAppCountQuery(APPLICATION_STATUS.HQ_APPROVED),
      buildThisMonthQuery(),
    ])

    // ---- Payments (pending = zengin_export_date IS NULL) ----
    let paymentQuery = supabase
      .from('payments')
      .select('payment_amount')
      .is('zengin_export_date', null)

    if (isApprover && companyCode) {
      // payments may not have company_code directly; join via application_id
      // For now, we filter payments that belong to applications of the same company
      const { data: companyAppIds } = await supabase
        .from('applications')
        .select('application_id')
        .eq('company_code', companyCode)
      const appIds = (companyAppIds ?? []).map(a => a.application_id)
      if (appIds.length > 0) {
        paymentQuery = paymentQuery.in('application_id', appIds)
      } else {
        // No applications for this company, skip payment query
        return {
          members: {
            total: totalRes.count ?? 0,
            active: activeRes.count ?? 0,
            onLeave: onLeaveRes.count ?? 0,
          },
          applications: {
            pending: pendingRes.count ?? 0,
            companyApproved: companyApprovedRes.count ?? 0,
            hqApproved: hqApprovedRes.count ?? 0,
            thisMonth: thisMonthRes.count ?? 0,
          },
          payments: { pendingCount: 0, pendingAmount: 0 },
          fees: { currentMonth, totalFee: 0, paidAmount: 0 },
        }
      }
    }

    const { data: pendingPayments, error: paymentError } = await paymentQuery

    let pendingCount = 0
    let pendingAmount = 0
    if (!paymentError && pendingPayments) {
      pendingCount = pendingPayments.length
      pendingAmount = pendingPayments.reduce(
        (sum, p) => sum + (p.payment_amount ?? 0),
        0,
      )
    }

    // ---- Monthly Fees ----
    let feeQuery = supabase
      .from('monthly_fees')
      .select('total_fee, paid_amount')
      .eq('year_month', currentMonth)

    if (isApprover && companyCode) {
      feeQuery = feeQuery.eq('company_code', companyCode)
    }

    const { data: feeRows, error: feeError } = await feeQuery

    let totalFee = 0
    let paidAmount = 0
    if (!feeError && feeRows) {
      totalFee = feeRows.reduce((sum, r) => sum + (r.total_fee ?? 0), 0)
      paidAmount = feeRows.reduce((sum, r) => sum + (r.paid_amount ?? 0), 0)
    }

    return {
      members: {
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
        onLeave: onLeaveRes.count ?? 0,
      },
      applications: {
        pending: pendingRes.count ?? 0,
        companyApproved: companyApprovedRes.count ?? 0,
        hqApproved: hqApprovedRes.count ?? 0,
        thisMonth: thisMonthRes.count ?? 0,
      },
      payments: {
        pendingCount,
        pendingAmount,
      },
      fees: {
        currentMonth,
        totalFee,
        paidAmount,
      },
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return emptyStats
    }
    throw err
  }
}

/**
 * 給付金統計情報を取得する（admin・approver専用）
 *
 * デフォルト期間: 当年1月1日 〜 本日
 * ステータスが PAID で payment_completed_date が期間内の申請を集計する。
 * approverの場合は自社のデータのみに制限される。
 */
export async function getBenefitStatistics(
  startDate?: string,
  endDate?: string,
  companyCode?: string,
): Promise<BenefitStatistics> {
  const emptyResult: BenefitStatistics = {
    summary: { totalCount: 0, totalAmount: 0 },
    byType: [],
    byMonth: [],
    byCompany: [],
  }

  try {
    const { supabase, profile } = await requireRole(['admin', 'approver'])

    // approverの場合は自社コードを強制する
    let effectiveCompanyCode = companyCode
    if (profile.role === 'approver') {
      effectiveCompanyCode = profile.company_code ?? undefined
    }

    const today = getToday()
    const effectiveStart = startDate ?? `${new Date().getFullYear()}-01-01`
    const effectiveEnd = endDate ?? today

    // Fetch all PAID applications within the date range
    let query = supabase
      .from('applications')
      .select(
        'benefit_type_code, benefit_type_name, final_amount, payment_completed_date, company_code, company_name',
      )
      .eq('status', APPLICATION_STATUS.PAID)
      .gte('payment_completed_date', effectiveStart)
      .lte('payment_completed_date', effectiveEnd)

    if (effectiveCompanyCode) {
      query = query.eq('company_code', effectiveCompanyCode)
    }

    const { data: rows, error } = await query

    if (error || !rows) {
      console.error('給付金統計の取得に失敗しました:', error?.message)
      return emptyResult
    }

    // ---- Summary ----
    const totalCount = rows.length
    const totalAmount = rows.reduce((sum, r) => sum + (r.final_amount ?? 0), 0)

    // ---- Group by benefit type ----
    const typeMap = new Map<string, { code: string; name: string; count: number; amount: number }>()
    for (const r of rows) {
      const code = r.benefit_type_code ?? ''
      const existing = typeMap.get(code)
      if (existing) {
        existing.count++
        existing.amount += r.final_amount ?? 0
      } else {
        typeMap.set(code, {
          code,
          name: r.benefit_type_name ?? benefitTypeName(code),
          count: 1,
          amount: r.final_amount ?? 0,
        })
      }
    }
    const byType = Array.from(typeMap.values())
      .map((t) => ({
        ...t,
        avgAmount: t.count > 0 ? Math.round(t.amount / t.count) : 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code))

    // ---- Group by month ----
    const monthMap = new Map<string, { count: number; amount: number }>()
    for (const r of rows) {
      const month = toMonthString(r.payment_completed_date ?? '')
      if (!month) continue
      const existing = monthMap.get(month)
      if (existing) {
        existing.count++
        existing.amount += r.final_amount ?? 0
      } else {
        monthMap.set(month, { count: 1, amount: r.final_amount ?? 0 })
      }
    }
    const byMonth = Array.from(monthMap.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // ---- Group by company ----
    const companyMap = new Map<string, { companyCode: string; companyName: string; count: number; amount: number }>()
    for (const r of rows) {
      const code = r.company_code ?? ''
      const existing = companyMap.get(code)
      if (existing) {
        existing.count++
        existing.amount += r.final_amount ?? 0
      } else {
        companyMap.set(code, {
          companyCode: code,
          companyName: r.company_name ?? '',
          count: 1,
          amount: r.final_amount ?? 0,
        })
      }
    }
    const byCompany = Array.from(companyMap.values()).sort((a, b) =>
      a.companyCode.localeCompare(b.companyCode),
    )

    return {
      summary: { totalCount, totalAmount },
      byType,
      byMonth,
      byCompany,
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return emptyResult
    }
    throw err
  }
}

/**
 * 月次レポートデータを収集する（admin専用）
 *
 * yearMonth: "YYYY-MM" 形式
 */
export async function collectMonthlyData(yearMonth: string): Promise<MonthlyReportData> {
  const emptyResult: MonthlyReportData = {
    members: { total: 0, active: 0, onLeave: 0, newEnrollments: 0, withdrawals: 0 },
    fees: [],
    benefits: [],
    applications: { pending: 0, companyApproved: 0, hqApproved: 0, paid: 0, rejected: 0 },
  }

  try {
    const { supabase } = await requireRole(['admin'])

    const { start: monthStart, end: monthEnd } = getMonthRange(yearMonth)

    // ---- Members ----
    const [totalRes, activeRes, onLeaveRes] = await Promise.all([
      supabase.from('members').select('*', { count: 'exact', head: true }),
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('employment_status', '在職中'),
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('employment_status', '休会中'),
    ])

    // New enrollments within the month
    const { count: newEnrollments } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('enrollment_date', monthStart)
      .lte('enrollment_date', monthEnd)

    // Withdrawals within the month
    const { count: withdrawals } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('withdrawal_date', monthStart)
      .lte('withdrawal_date', monthEnd)

    // ---- Monthly Fees ----
    const { data: feeRows, error: feeError } = await supabase
      .from('monthly_fees')
      .select('company_name, member_count, total_fee, paid_amount, status')
      .eq('year_month', yearMonth)

    const fees: MonthlyReportData['fees'] = []
    if (!feeError && feeRows) {
      for (const row of feeRows) {
        fees.push({
          companyName: row.company_name ?? '',
          memberCount: row.member_count ?? 0,
          invoiceAmount: row.total_fee ?? 0,
          paidAmount: row.paid_amount ?? 0,
          status: row.status ?? '',
        })
      }
    }

    // ---- Benefits (PAID applications within the month) ----
    const { data: paidApps, error: paidError } = await supabase
      .from('applications')
      .select('benefit_type_code, benefit_type_name, final_amount')
      .eq('status', APPLICATION_STATUS.PAID)
      .gte('payment_completed_date', monthStart)
      .lte('payment_completed_date', monthEnd)

    const benefitMap = new Map<string, { name: string; count: number; amount: number }>()
    if (!paidError && paidApps) {
      for (const app of paidApps) {
        const code = app.benefit_type_code ?? ''
        const existing = benefitMap.get(code)
        if (existing) {
          existing.count++
          existing.amount += app.final_amount ?? 0
        } else {
          benefitMap.set(code, {
            name: app.benefit_type_name ?? benefitTypeName(code),
            count: 1,
            amount: app.final_amount ?? 0,
          })
        }
      }
    }
    const benefits = Array.from(benefitMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )

    // ---- Applications created within the month (status counts) ----
    const { data: monthApps, error: monthAppsError } = await supabase
      .from('applications')
      .select('status')
      .gte('created_at', `${monthStart}T00:00:00`)
      .lte('created_at', `${monthEnd}T23:59:59`)

    const appStats = {
      pending: 0,
      companyApproved: 0,
      hqApproved: 0,
      paid: 0,
      rejected: 0,
    }

    if (!monthAppsError && monthApps) {
      for (const row of monthApps) {
        switch (row.status) {
          case APPLICATION_STATUS.PENDING:
            appStats.pending++
            break
          case APPLICATION_STATUS.COMPANY_APPROVED:
            appStats.companyApproved++
            break
          case APPLICATION_STATUS.HQ_APPROVED:
            appStats.hqApproved++
            break
          case APPLICATION_STATUS.PAID:
            appStats.paid++
            break
          case APPLICATION_STATUS.REJECTED:
            appStats.rejected++
            break
        }
      }
    }

    return {
      members: {
        total: totalRes.count ?? 0,
        active: activeRes.count ?? 0,
        onLeave: onLeaveRes.count ?? 0,
        newEnrollments: newEnrollments ?? 0,
        withdrawals: withdrawals ?? 0,
      },
      fees,
      benefits,
      applications: appStats,
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return emptyResult
    }
    throw err
  }
}
