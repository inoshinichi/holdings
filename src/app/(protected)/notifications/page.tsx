'use client'

import { useState, useEffect, useTransition } from 'react'
import { sendAdminNotification, type AdminNotificationInput } from '@/lib/actions/notifications'
import { getCompanies } from '@/lib/actions/master'
import { getMembers } from '@/lib/actions/members'
import type { Company, Member } from '@/types/database'
import { Send, Loader2, CheckCircle2, Bell, Users, Building2, User } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NotificationsPage() {
  const [isPending, startTransition] = useTransition()

  // Form fields
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<'all' | 'company' | 'member'>('all')
  const [companyCode, setCompanyCode] = useState('')
  const [memberId, setMemberId] = useState('')

  // Data for dropdowns
  const [companies, setCompanies] = useState<Company[]>([])
  const [members, setMembers] = useState<Member[]>([])

  // Result
  const [sentCount, setSentCount] = useState<number | null>(null)

  useEffect(() => {
    getCompanies().then(setCompanies)
    getMembers().then(setMembers)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSentCount(null)

    const input: AdminNotificationInput = {
      title,
      message,
      target,
      companyCode: target === 'company' ? companyCode : undefined,
      memberId: target === 'member' ? memberId : undefined,
    }

    startTransition(async () => {
      const result = await sendAdminNotification(input)
      if (result.success) {
        setSentCount(result.count)
        setTitle('')
        setMessage('')
        toast.success(`${result.count}名に通知を送信しました`)
      } else {
        toast.error(result.error)
      }
    })
  }

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  const TARGET_OPTIONS = [
    { value: 'all' as const, label: '全ユーザー', icon: Users, desc: 'すべてのアクティブユーザーに送信' },
    { value: 'company' as const, label: '会社別', icon: Building2, desc: '特定の会社のユーザーに送信' },
    { value: 'member' as const, label: '個人', icon: User, desc: '特定の会員に送信' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl font-bold text-gray-800">通知管理</h2>
      </div>

      {/* Success banner */}
      {sentCount !== null && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            {sentCount}名に通知を送信しました
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Target selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">送信先</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TARGET_OPTIONS.map(opt => {
              const Icon = opt.icon
              const isActive = target === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTarget(opt.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition text-center ${
                    isActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{opt.desc}</span>
                </button>
              )
            })}
          </div>

          {/* Company selector */}
          {target === 'company' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">会社を選択</label>
              <select
                value={companyCode}
                onChange={e => setCompanyCode(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">選択してください</option>
                {companies.map(c => (
                  <option key={c.company_code} value={c.company_code}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Member selector */}
          {target === 'member' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">会員を選択</label>
              <select
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">選択してください</option>
                {members.map(m => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.member_id} - {m.last_name} {m.first_name}（{m.company_name}）
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4">通知内容</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="お知らせのタイトル"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メッセージ <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={4}
                placeholder="通知の内容を入力してください"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !title.trim() || !message.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            送信する
          </button>
        </div>
      </form>
    </div>
  )
}
