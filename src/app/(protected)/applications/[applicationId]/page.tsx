'use client'

import { useEffect, useState } from 'react'
import { getApplication } from '@/lib/actions/applications'
import { getAttachments, uploadAttachment, deleteAttachment } from '@/lib/actions/attachments'
import type { AttachmentInfo } from '@/lib/actions/attachments'
import { formatDate } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/format'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { useParams } from 'next/navigation'
import type { Application } from '@/types/database'
import { Paperclip, Trash2, FileText, Image as ImageIcon, AlertCircle, CheckCircle2 } from 'lucide-react'

const CONTENT_KEY_LABELS: Record<string, string> = {
  memberId: '会員ID',
  eventDate: 'イベント日',
  isRemarriage: '再婚',
  isForChild: '子の結婚',
  childCount: '出産人数',
  isStillbirth: '死産',
  schoolType: '学校種別',
  absenceDays: '欠勤日数',
  standardMonthlyRemuneration: '標準報酬月額',
  damageLevel: '被害程度',
  isOwnHouse: '持ち家',
  isHeadOfHousehold: '世帯主',
  relationship: '続柄',
  isChiefMourner: '喪主',
  withdrawalDate: '脱会日',
}

const CONTENT_VALUE_LABELS: Record<string, Record<string, string>> = {
  damageLevel: {
    TOTAL_LOSS: '全焼・全壊',
    HALF_BURN: '半焼',
    HALF_DAMAGE: '半壊',
  },
  relationship: {
    MEMBER: '会員本人',
    SPOUSE: '配偶者',
    PARENT: '親',
    CHILD: '子',
    GRANDPARENT_SIBLING: '祖父母・兄弟姉妹',
  },
}

function formatContentValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'はい' : 'いいえ'
  const valMap = CONTENT_VALUE_LABELS[key]
  if (valMap && typeof value === 'string' && valMap[value]) return valMap[value]
  return String(value)
}

export default function ApplicationDetailPage() {
  const params = useParams()
  const applicationId = params.applicationId as string

  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState('')
  const [attachSuccess, setAttachSuccess] = useState('')

  useEffect(() => {
    async function load() {
      const [data, files] = await Promise.all([
        getApplication(applicationId),
        getAttachments(applicationId),
      ])
      setApp(data)
      setAttachments(files)
      setLoading(false)
    }
    load()
  }, [applicationId])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setAttachError('')
    setAttachSuccess('')
    setUploading(true)

    let successCount = 0
    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer()
      const result = await uploadAttachment(applicationId, file.name, buffer, file.type)
      if (result.success) {
        successCount++
      } else {
        setAttachError(result.error)
        break
      }
    }

    if (successCount > 0) {
      setAttachSuccess(`${successCount}件のファイルをアップロードしました`)
      const updated = await getAttachments(applicationId)
      setAttachments(updated)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDeleteAttachment(path: string) {
    setAttachError('')
    setAttachSuccess('')
    const result = await deleteAttachment(applicationId, path)
    if (result.success) {
      setAttachments(prev => prev.filter(a => a.path !== path))
    } else {
      setAttachError(result.error ?? '削除に失敗しました')
    }
  }

  function isImage(name: string) {
    return /\.(jpg|jpeg|png)$/i.test(name)
  }

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
      {content && Object.keys(content).filter(k => k !== 'memberId').length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">申請内容詳細</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(content)
              .filter(([key]) => key !== 'memberId')
              .map(([key, value]) => (
              <div key={key}>
                <p className="text-sm text-gray-500">{CONTENT_KEY_LABELS[key] ?? key}</p>
                <p className="font-medium">{formatContentValue(key, value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添付ファイル */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Paperclip className="w-5 h-5" />
          証明書・添付ファイル
        </h2>

        <div className="space-y-4">
          {/* Upload area */}
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
              <Paperclip className="w-4 h-4" />
              {uploading ? 'アップロード中...' : 'ファイルを追加'}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <span className="text-xs text-gray-500">対応形式: JPG, PNG, PDF（最大5MB）</span>
          </div>

          {attachError && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {attachError}
            </p>
          )}
          {attachSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {attachSuccess}
            </p>
          )}

          {/* File list */}
          {attachments.length === 0 ? (
            <p className="text-sm text-gray-400">添付ファイルはありません</p>
          ) : (
            <div className="space-y-2">
              {attachments.map(att => (
                <div
                  key={att.path}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  {isImage(att.name) ? (
                    <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-blue-600 hover:underline truncate"
                  >
                    {att.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(att.path)}
                    className="text-gray-400 hover:text-red-600 transition"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
