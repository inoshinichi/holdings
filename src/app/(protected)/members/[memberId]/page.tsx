'use client'

import { useEffect, useState, useTransition } from 'react'
import { getMember, updateMember, setMemberOnLeave, withdrawMember } from '@/lib/actions/members'
import { getApplications } from '@/lib/actions/applications'
import { formatDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/format'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { useParams, useRouter } from 'next/navigation'
import type { Member, Application } from '@/types/database'

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.memberId as string

  const [member, setMember] = useState<Member | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const m = await getMember(memberId)
      if (m) {
        setMember(m)
        const apps = await getApplications({ memberId: m.member_id })
        setApplications(apps)
      }
      setLoading(false)
    }
    load()
  }, [memberId])

  async function handleLeave() {
    if (!confirm('この会員を休会にしますか？')) return
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const result = await setMemberOnLeave(memberId, today)
      if (result.success) {
        setMessage('休会に変更しました')
        const m = await getMember(memberId)
        if (m) setMember(m)
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  async function handleWithdraw() {
    if (!confirm('この会員を退会にしますか？この操作は取り消せません。')) return
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10)
      const result = await withdrawMember(memberId, today)
      if (result.success) {
        setMessage('退会処理が完了しました')
        const m = await getMember(memberId)
        if (m) setMember(m)
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">会員が見つかりません</p>
        <a href="/members" className="text-blue-600 hover:underline mt-4 inline-block">← 会員一覧に戻る</a>
      </div>
    )
  }

  const statusColor = member.employment_status === '在職中'
    ? 'bg-green-100 text-green-800'
    : member.employment_status === '休会中'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-gray-100 text-gray-800'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/members" className="text-gray-500 hover:text-gray-700">← 会員一覧</a>
          <h1 className="text-2xl font-bold text-gray-800">{member.last_name} {member.first_name}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
            {member.employment_status}
          </span>
        </div>
        <div className="flex gap-2">
          {member.employment_status === '在職中' && (
            <>
              <button
                onClick={handleLeave}
                disabled={isPending}
                className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50"
              >
                休会にする
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isPending}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
              >
                退会にする
              </button>
            </>
          )}
          {member.employment_status === '休会中' && (
            <button
              onClick={handleWithdraw}
              disabled={isPending}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              退会にする
            </button>
          )}
        </div>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>}

      {/* 基本情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">会員ID</p>
            <p className="font-medium">{member.member_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">氏名</p>
            <p className="font-medium">{member.last_name} {member.first_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">氏名（カナ）</p>
            <p className="font-medium">{member.last_name_kana} {member.first_name_kana}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">会社</p>
            <p className="font-medium">{member.company_name}（{member.company_code}）</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">生年月日</p>
            <p className="font-medium">{member.birth_date ? formatDate(member.birth_date) : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">性別</p>
            <p className="font-medium">{member.gender || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">メールアドレス</p>
            <p className="font-medium">{member.email || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">入会日</p>
            <p className="font-medium">{formatDate(member.enrollment_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">退会日</p>
            <p className="font-medium">{member.withdrawal_date ? formatDate(member.withdrawal_date) : '-'}</p>
          </div>
        </div>
      </div>

      {/* 雇用・会費情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">雇用・会費情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">在職状況</p>
            <p className="font-medium">{member.employment_status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">雇用形態</p>
            <p className="font-medium">{member.employment_type || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">役職区分</p>
            <p className="font-medium">{member.position_category || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">会費区分</p>
            <p className="font-medium">{member.fee_category}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">会費金額</p>
            <p className="font-medium">{formatCurrency(member.fee_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">標準報酬月額</p>
            <p className="font-medium">{member.standard_monthly_remuneration ? formatCurrency(member.standard_monthly_remuneration) : '-'}</p>
          </div>
        </div>
      </div>

      {/* 口座情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">口座情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">銀行</p>
            <p className="font-medium">{member.bank_name || '-'}（{member.bank_code || '-'}）</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">支店</p>
            <p className="font-medium">{member.branch_name || '-'}（{member.branch_code || '-'}）</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">口座種別</p>
            <p className="font-medium">{member.account_type || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">口座番号</p>
            <p className="font-medium">{member.account_number || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">口座名義</p>
            <p className="font-medium">{member.account_holder || '-'}</p>
          </div>
        </div>
      </div>

      {/* 申請履歴 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">申請履歴</h2>
        {applications.length === 0 ? (
          <p className="text-gray-500 text-sm">申請履歴はありません</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-600">
                <th className="px-4 py-2">申請ID</th>
                <th className="px-4 py-2">申請日</th>
                <th className="px-4 py-2">給付金種別</th>
                <th className="px-4 py-2 text-right">金額</th>
                <th className="px-4 py-2">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => (
                <tr key={app.application_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{app.application_id}</td>
                  <td className="px-4 py-2 text-sm">{formatDate(app.application_date)}</td>
                  <td className="px-4 py-2 text-sm">{app.benefit_type_name}</td>
                  <td className="px-4 py-2 text-sm text-right">{formatCurrency(app.final_amount)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(app.status)}`}>
                      {getStatusLabel(app.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
