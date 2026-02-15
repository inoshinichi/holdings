import { getMembers, getMemberStats } from '@/lib/actions/members'
import { getCompanies } from '@/lib/actions/master'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils/date'
import { formatNumber } from '@/lib/utils/format'
import Link from 'next/link'
import { Users, UserCheck, UserMinus, Clock } from 'lucide-react'
import type { UserProfile } from '@/types/database'

const STATUS_BADGE: Record<string, string> = {
  '在職中': 'bg-green-100 text-green-700',
  '休会中': 'bg-yellow-100 text-yellow-700',
  '退会':   'bg-gray-100 text-gray-500',
}

export default async function MembersPage({
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

  // approverの場合は自社のみに強制
  const companyCode = isApprover ? (typedProfile.company_code ?? '') : (params.companyCode ?? '')
  const status = params.status ?? ''
  const feeCategory = params.feeCategory ?? ''

  const filters: { companyCode?: string; status?: string; feeCategory?: string } = {}
  if (companyCode) filters.companyCode = companyCode
  if (status) filters.status = status
  if (feeCategory) filters.feeCategory = feeCategory

  const [members, stats, companies] = await Promise.all([
    getMembers(Object.keys(filters).length > 0 ? filters : undefined),
    getMemberStats(isApprover ? (typedProfile.company_code ?? undefined) : undefined),
    getCompanies(),
  ])

  const statCards = [
    { label: '会員総数', value: formatNumber(stats.total),     icon: Users,     color: 'text-blue-600 bg-blue-50' },
    { label: '在職中',   value: formatNumber(stats.active),    icon: UserCheck, color: 'text-green-600 bg-green-50' },
    { label: '休会中',   value: formatNumber(stats.onLeave),   icon: Clock,     color: 'text-yellow-600 bg-yellow-50' },
    { label: '退会',     value: formatNumber(stats.withdrawn),  icon: UserMinus, color: 'text-gray-600 bg-gray-100' },
  ]

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">会員一覧</h2>
        <Link
          href="/members/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
        >
          新規会員登録
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4"
            >
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <form className="flex flex-wrap items-end gap-4">
          {/* Company filter - approverの場合は非表示 */}
          {!isApprover && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">会社</label>
              <select
                name="companyCode"
                defaultValue={companyCode}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                {companies.map((c) => (
                  <option key={c.company_code} value={c.company_code}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">在職状況</label>
            <select
              name="status"
              defaultValue={status}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">すべて</option>
              <option value="在職中">在職中</option>
              <option value="休会中">休会中</option>
              <option value="退会">退会</option>
            </select>
          </div>

          {/* Fee category filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">会費区分</label>
            <select
              name="feeCategory"
              defaultValue={feeCategory}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">すべて</option>
              <option value="一般社員">一般社員</option>
              <option value="係長以上">係長以上</option>
              <option value="部長職以上">部長職以上</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
          >
            検索
          </button>

          {/* Clear */}
          {((!isApprover && companyCode) || status || feeCategory) && (
            <Link
              href="/members"
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition"
            >
              クリア
            </Link>
          )}
        </form>
      </div>

      {/* Members table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">会員ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">氏名</th>
                {!isApprover && <th className="text-left px-4 py-3 font-medium text-gray-600">会社</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-600">在職状況</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">会費区分</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">入会日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={isApprover ? 5 : 6} className="px-4 py-8 text-center text-gray-400">
                    該当する会員が見つかりません
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr
                    key={member.member_id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${member.member_id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {member.member_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {member.last_name} {member.first_name}
                    </td>
                    {!isApprover && (
                      <td className="px-4 py-3 text-gray-600">
                        {member.company_name}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_BADGE[member.employment_status] ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {member.employment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {member.fee_category}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(member.enrollment_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        {members.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
            {formatNumber(members.length)} 件表示
          </div>
        )}
      </div>
    </div>
  )
}
