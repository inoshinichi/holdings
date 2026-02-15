'use client'

import { useEffect, useState } from 'react'
import { getApplication } from '@/lib/actions/applications'
import { formatDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/format'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { useParams } from 'next/navigation'
import type { Application } from '@/types/database'

export default function ApplicationDetailPage() {
  const params = useParams()
  const applicationId = params.applicationId as string

  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await getApplication(applicationId)
      setApp(data)
      setLoading(false)
    }
    load()
  }, [applicationId])

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>
  }

  if (!app) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">申請が見つかりません</p>
        <a href="/applications" className="text-blue-600 hover:underline mt-4 inline-block">← 申請一覧に戻る</a>
      </div>
    )
  }

  const content = app.application_content as Record<string, unknown> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/applications" className="text-gray-500 hover:text-gray-700">← 申請一覧</a>
          <h1 className="text-2xl font-bold text-gray-800">{app.application_id}</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(app.status)}`}>
            {getStatusLabel(app.status)}
          </span>
        </div>
      </div>

      {/* 申請情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">申請情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">申請ID</p>
            <p className="font-medium">{app.application_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">申請日</p>
            <p className="font-medium">{formatDate(app.application_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">給付金種別</p>
            <p className="font-medium">{app.benefit_type_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">会員ID</p>
            <a href={`/members/${app.member_id}`} className="font-medium text-blue-600 hover:underline">{app.member_id}</a>
          </div>
          <div>
            <p className="text-sm text-gray-500">会員名</p>
            <p className="font-medium">{app.member_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">会社</p>
            <p className="font-medium">{app.company_name}（{app.company_code}）</p>
          </div>
        </div>
      </div>

      {/* 金額情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">金額情報</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">計算額</p>
            <p className="font-medium text-lg">{formatCurrency(app.calculated_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">最終金額</p>
            <p className="font-medium text-lg text-blue-600">{formatCurrency(app.final_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">入会年数</p>
            <p className="font-medium">{app.membership_years != null ? `${app.membership_years}年` : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">標準報酬月額</p>
            <p className="font-medium">{app.standard_monthly_remuneration ? formatCurrency(app.standard_monthly_remuneration) : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">支払予定日</p>
            <p className="font-medium">{app.scheduled_payment_date ? formatDate(app.scheduled_payment_date) : '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">支払完了日</p>
            <p className="font-medium">{app.payment_completed_date ? formatDate(app.payment_completed_date) : '-'}</p>
          </div>
        </div>
      </div>

      {/* 承認情報 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">承認情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700">各社承認</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-gray-500">承認者</p>
                <p className="font-medium">{app.company_approver || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">承認日</p>
                <p className="font-medium">{app.company_approval_date ? formatDate(app.company_approval_date) : '-'}</p>
              </div>
            </div>
            {app.company_comment && (
              <div>
                <p className="text-sm text-gray-500">コメント</p>
                <p className="text-sm bg-gray-50 p-2 rounded">{app.company_comment}</p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700">本部承認</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-sm text-gray-500">承認者</p>
                <p className="font-medium">{app.hq_approver || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">承認日</p>
                <p className="font-medium">{app.hq_approval_date ? formatDate(app.hq_approval_date) : '-'}</p>
              </div>
            </div>
            {app.hq_comment && (
              <div>
                <p className="text-sm text-gray-500">コメント</p>
                <p className="text-sm bg-gray-50 p-2 rounded">{app.hq_comment}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 申請内容（JSONB） */}
      {content && Object.keys(content).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">申請内容詳細</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(content).map(([key, value]) => (
              <div key={key}>
                <p className="text-sm text-gray-500">{key}</p>
                <p className="font-medium">{String(value ?? '-')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
