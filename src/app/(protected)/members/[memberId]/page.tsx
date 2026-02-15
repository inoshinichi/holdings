'use client'

import { useEffect, useState, useTransition } from 'react'
import { getMember, updateMember, setMemberOnLeave, withdrawMember } from '@/lib/actions/members'
import { getApplications } from '@/lib/actions/applications'
import { getCurrentUser } from '@/lib/actions/auth'
import { formatDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/format'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Member, Application, FeeCategory } from '@/types/database'
import { Pencil, Save, X } from 'lucide-react'

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

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, string | number | null>>({})

  useEffect(() => {
    async function load() {
      // 認可チェック: approverは自社会員のみ閲覧可能
      const userProfile = await getCurrentUser()
      let m: Member | null = null
      if (userProfile?.role === 'approver' && userProfile.company_code) {
        m = await getMember(memberId, userProfile.company_code)
        if (!m) {
          router.replace('/members')
          return
        }
      } else {
        m = await getMember(memberId)
      }
      if (m) {
        setMember(m)
        const apps = await getApplications({ memberId: m.member_id })
        setApplications(apps)
      }
      setLoading(false)
    }
    load()
  }, [memberId, router])

  function startEditing() {
    if (!member) return
    setEditData({
      last_name: member.last_name,
      first_name: member.first_name,
      last_name_kana: member.last_name_kana ?? '',
      first_name_kana: member.first_name_kana ?? '',
      birth_date: member.birth_date ?? '',
      gender: member.gender ?? '',
      email: member.email ?? '',
      employment_type: member.employment_type ?? '',
      position_category: member.position_category ?? '',
      fee_category: member.fee_category,
      standard_monthly_remuneration: member.standard_monthly_remuneration ?? '',
      bank_code: member.bank_code ?? '',
      bank_name: member.bank_name ?? '',
      branch_code: member.branch_code ?? '',
      branch_name: member.branch_name ?? '',
      account_type: member.account_type ?? '',
      account_number: member.account_number ?? '',
      account_holder: member.account_holder ?? '',
    })
    setEditing(true)
    setError('')
    setMessage('')
  }

  function cancelEditing() {
    setEditing(false)
    setEditData({})
  }

  function handleEditChange(field: string, value: string | number | null) {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!member) return
    setError('')
    setMessage('')

    startTransition(async () => {
      // Build update payload - only send changed fields
      const updates: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(editData)) {
        const original = (member as unknown as Record<string, unknown>)[key]
        const normalizedVal = val === '' ? null : val
        const normalizedOrig = original === undefined ? null : original
        if (normalizedVal !== normalizedOrig) {
          updates[key] = normalizedVal
        }
      }

      if (Object.keys(updates).length === 0) {
        setEditing(false)
        return
      }

      const result = await updateMember(memberId, updates)
      if (result.success) {
        setMessage('会員情報を更新しました')
        setEditing(false)
        const m = await getMember(memberId)
        if (m) setMember(m)
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

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
        <Link href="/members" className="text-blue-600 hover:underline mt-4 inline-block">← 会員一覧に戻る</Link>
      </div>
    )
  }

  const statusColor = member.employment_status === '在職中'
    ? 'bg-green-100 text-green-800'
    : member.employment_status === '休会中'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-gray-100 text-gray-800'

  const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/members" className="text-gray-500 hover:text-gray-700">← 会員一覧</Link>
          <h1 className="text-2xl font-bold text-gray-800">{member.last_name} {member.first_name}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
            {member.employment_status}
          </span>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button
              onClick={startEditing}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
              <button
                onClick={cancelEditing}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
            </>
          )}
          {!editing && member.employment_status === '在職中' && (
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
          {!editing && member.employment_status === '休会中' && (
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
            {editing ? (
              <div className="flex gap-1">
                <input className={inputClass} value={String(editData.last_name ?? '')} onChange={e => handleEditChange('last_name', e.target.value)} placeholder="姓" />
                <input className={inputClass} value={String(editData.first_name ?? '')} onChange={e => handleEditChange('first_name', e.target.value)} placeholder="名" />
              </div>
            ) : (
              <p className="font-medium">{member.last_name} {member.first_name}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">氏名（カナ）</p>
            {editing ? (
              <div className="flex gap-1">
                <input className={inputClass} value={String(editData.last_name_kana ?? '')} onChange={e => handleEditChange('last_name_kana', e.target.value)} placeholder="セイ" />
                <input className={inputClass} value={String(editData.first_name_kana ?? '')} onChange={e => handleEditChange('first_name_kana', e.target.value)} placeholder="メイ" />
              </div>
            ) : (
              <p className="font-medium">{member.last_name_kana} {member.first_name_kana}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">会社</p>
            <p className="font-medium">{member.company_name}（{member.company_code}）</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">生年月日</p>
            {editing ? (
              <input type="date" className={inputClass} value={String(editData.birth_date ?? '')} onChange={e => handleEditChange('birth_date', e.target.value)} />
            ) : (
              <p className="font-medium">{member.birth_date ? formatDate(member.birth_date) : '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">性別</p>
            {editing ? (
              <select className={inputClass} value={String(editData.gender ?? '')} onChange={e => handleEditChange('gender', e.target.value)}>
                <option value="">-</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="その他">その他</option>
              </select>
            ) : (
              <p className="font-medium">{member.gender || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">メールアドレス</p>
            {editing ? (
              <input type="email" className={inputClass} value={String(editData.email ?? '')} onChange={e => handleEditChange('email', e.target.value)} />
            ) : (
              <p className="font-medium">{member.email || '-'}</p>
            )}
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
            {editing ? (
              <select className={inputClass} value={String(editData.employment_type ?? '')} onChange={e => handleEditChange('employment_type', e.target.value)}>
                <option value="">-</option>
                <option value="正社員">正社員</option>
                <option value="契約社員">契約社員</option>
                <option value="パート">パート</option>
                <option value="嘱託">嘱託</option>
              </select>
            ) : (
              <p className="font-medium">{member.employment_type || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">役職区分</p>
            {editing ? (
              <select className={inputClass} value={String(editData.position_category ?? '')} onChange={e => handleEditChange('position_category', e.target.value)}>
                <option value="">-</option>
                <option value="一般">一般</option>
                <option value="係長">係長</option>
                <option value="課長">課長</option>
                <option value="部長">部長</option>
                <option value="役員">役員</option>
              </select>
            ) : (
              <p className="font-medium">{member.position_category || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">会費区分</p>
            {editing ? (
              <select className={inputClass} value={String(editData.fee_category ?? '')} onChange={e => handleEditChange('fee_category', e.target.value as FeeCategory)}>
                <option value="一般社員">一般社員</option>
                <option value="係長以上">係長以上</option>
                <option value="部長職以上">部長職以上</option>
              </select>
            ) : (
              <p className="font-medium">{member.fee_category}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">会費金額</p>
            <p className="font-medium">{formatCurrency(member.fee_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">標準報酬月額</p>
            {editing ? (
              <input type="number" className={inputClass} value={editData.standard_monthly_remuneration ?? ''} onChange={e => handleEditChange('standard_monthly_remuneration', e.target.value ? parseInt(e.target.value, 10) : null)} />
            ) : (
              <p className="font-medium">{member.standard_monthly_remuneration ? formatCurrency(member.standard_monthly_remuneration) : '-'}</p>
            )}
          </div>
        </div>
      </div>

      {/* 口座情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">口座情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">銀行名</p>
            {editing ? (
              <input className={inputClass} value={String(editData.bank_name ?? '')} onChange={e => handleEditChange('bank_name', e.target.value)} />
            ) : (
              <p className="font-medium">{member.bank_name || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">銀行コード</p>
            {editing ? (
              <input className={inputClass} value={String(editData.bank_code ?? '')} onChange={e => handleEditChange('bank_code', e.target.value)} maxLength={4} />
            ) : (
              <p className="font-medium">{member.bank_code || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">支店名</p>
            {editing ? (
              <input className={inputClass} value={String(editData.branch_name ?? '')} onChange={e => handleEditChange('branch_name', e.target.value)} />
            ) : (
              <p className="font-medium">{member.branch_name || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">支店コード</p>
            {editing ? (
              <input className={inputClass} value={String(editData.branch_code ?? '')} onChange={e => handleEditChange('branch_code', e.target.value)} maxLength={3} />
            ) : (
              <p className="font-medium">{member.branch_code || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">口座種別</p>
            {editing ? (
              <select className={inputClass} value={String(editData.account_type ?? '')} onChange={e => handleEditChange('account_type', e.target.value)}>
                <option value="">-</option>
                <option value="普通">普通</option>
                <option value="当座">当座</option>
              </select>
            ) : (
              <p className="font-medium">{member.account_type || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">口座番号</p>
            {editing ? (
              <input className={inputClass} value={String(editData.account_number ?? '')} onChange={e => handleEditChange('account_number', e.target.value)} maxLength={7} />
            ) : (
              <p className="font-medium">{member.account_number || '-'}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">口座名義</p>
            {editing ? (
              <input className={inputClass} value={String(editData.account_holder ?? '')} onChange={e => handleEditChange('account_holder', e.target.value)} />
            ) : (
              <p className="font-medium">{member.account_holder || '-'}</p>
            )}
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
                  <td className="px-4 py-2 text-sm">
                    <Link href={`/applications/${app.application_id}`} className="text-blue-600 hover:underline">
                      {app.application_id}
                    </Link>
                  </td>
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
