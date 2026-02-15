import Link from 'next/link'
import { getApplications, getApplicationStats } from '@/lib/actions/applications'
import { getCompanies } from '@/lib/actions/master'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { BENEFIT_TYPE_LIST } from '@/lib/constants/benefit-types'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import { FilePlus, FileText, CheckSquare, Building2, CircleCheck, CreditCard, XCircle } from 'lucide-react'
import type { UserProfile } from '@/types/database'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  // ユーザープロフィール取得
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_code')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  const typedProfile = profile as Pick<UserProfile, 'role' | 'company_code'>
  const isApprover = typedProfile.role === 'approver'

  const params = await searchParams
  const statusFilter = params.status ?? ''
  // approverの場合は自社に強制
  const companyFilter = isApprover ? (typedProfile.company_code ?? '') : (params.companyCode ?? '')
  const benefitFilter = params.benefitTypeCode ?? ''

  const [applications, stats, companies] = await Promise.all([
    getApplications({
      status: statusFilter || undefined,
      companyCode: companyFilter || undefined,
      benefitTypeCode: benefitFilter || undefined,
    }),
    getApplicationStats(isApprover ? (typedProfile.company_code ?? undefined) : undefined),
    getCompanies(),
  ])

  const statCards = [
    {
      label: '申請中',
      value: stats.pending,
      icon: FileText,
      color: 'text-yellow-600 bg-yellow-50',
      filterValue: 'PENDING',
    },
    {
      label: '各社承認済',
      value: stats.companyApproved,
      icon: CheckSquare,
      color: 'text-blue-600 bg-blue-50',
      filterValue: 'COMPANY_APPROVED',
    },
    {
      label: '本部承認済',
      value: stats.hqApproved,
      icon: Building2,
      color: 'text-cyan-600 bg-cyan-50',
      filterValue: 'HQ_APPROVED',
    },
    {
      label: '支払完了',
      value: stats.paid,
      icon: CreditCard,
      color: 'text-green-600 bg-green-50',
      filterValue: 'PAID',
    },
    {
      label: '差戻し',
      value: stats.rejected,
      icon: XCircle,
      color: 'text-red-600 bg-red-50',
      filterValue: 'REJECTED',
    },
  ]

  function buildFilterUrl(overrides: Record<string, string>) {
    const merged: Record<string, string> = {}
    if (statusFilter) merged.status = statusFilter
    if (!isApprover && companyFilter) merged.companyCode = companyFilter
    if (benefitFilter) merged.benefitTypeCode = benefitFilter
    Object.assign(merged, overrides)
    Object.keys(merged).forEach(k => {
      if (!merged[k]) delete merged[k]
    })
    const qs = new URLSearchParams(merged).toString()
    return qs ? `/applications?${qs}` : '/applications'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">申請一覧</h2>
        <Link
          href="/applications/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <FilePlus className="w-4 h-4" />
          新規申請
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map(card => {
          const Icon = card.icon
          const isActive = statusFilter === card.filterValue
          return (
            <Link
              key={card.filterValue}
              href={buildFilterUrl({
                status: isActive ? '' : card.filterValue,
              })}
              className={`bg-white rounded-lg border p-4 flex items-center gap-3 transition hover:shadow-sm ${
                isActive ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Filters */}
      <form method="GET" action="/applications" className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Status filter */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              ステータス
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">すべて</option>
              <option value="DRAFT">下書き</option>
              <option value="PENDING">申請中</option>
              <option value="COMPANY_APPROVED">各社承認済</option>
              <option value="HQ_APPROVED">本部承認済</option>
              <option value="PAID">支払完了</option>
              <option value="REJECTED">差戻し</option>
              <option value="CANCELLED">キャンセル</option>
            </select>
          </div>

          {/* Company filter - approverの場合は非表示 */}
          {!isApprover && (
            <div>
              <label htmlFor="companyCode" className="block text-sm font-medium text-gray-700 mb-1">
                会社
              </label>
              <select
                id="companyCode"
                name="companyCode"
                defaultValue={companyFilter}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">すべて</option>
                {companies.map(c => (
                  <option key={c.company_code} value={c.company_code}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Benefit type filter */}
          <div>
            <label htmlFor="benefitTypeCode" className="block text-sm font-medium text-gray-700 mb-1">
              給付金種別
            </label>
            <select
              id="benefitTypeCode"
              name="benefitTypeCode"
              defaultValue={benefitFilter}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">すべて</option>
              {BENEFIT_TYPE_LIST.map(b => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <CircleCheck className="w-4 h-4" />
            絞り込み
          </button>
          <Link
            href="/applications"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            クリア
          </Link>
        </div>
      </form>

      {/* Applications table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">申請ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">申請日</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">会員名</th>
                {!isApprover && <th className="px-4 py-3 text-left font-medium text-gray-600">会社</th>}
                <th className="px-4 py-3 text-left font-medium text-gray-600">給付金種別</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">金額</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={isApprover ? 6 : 7} className="px-4 py-12 text-center text-gray-400">
                    該当する申請がありません
                  </td>
                </tr>
              ) : (
                applications.map(app => (
                  <tr
                    key={app.application_id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/applications/${app.application_id}`} className="text-blue-600 hover:underline">
                        {app.application_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(app.application_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {app.member_name}
                    </td>
                    {!isApprover && (
                      <td className="px-4 py-3 text-gray-600">
                        {app.company_name}
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600">
                      {app.benefit_type_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium tabular-nums">
                      {formatCurrency(app.final_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(app.status)}`}
                      >
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with count */}
        {applications.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">
              全 {stats.total} 件中 {applications.length} 件表示
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
