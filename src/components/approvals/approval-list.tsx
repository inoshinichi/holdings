'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { approveByCompany, approveByHQ, rejectApplication } from '@/lib/actions/approvals'
import { getAttachments } from '@/lib/actions/attachments'
import type { AttachmentInfo } from '@/lib/actions/attachments'
import type { Application, UserRole } from '@/types/database'
import { Paperclip, FileText, Image as ImageIcon } from 'lucide-react'

interface ApprovalListProps {
  companyApprovals: Application[]
  hqApprovals: Application[]
  userRole: UserRole
}

type DialogMode = 'approve' | 'reject' | null

interface DialogState {
  mode: DialogMode
  application: Application | null
  level: 'company' | 'hq'
}

export function ApprovalList({
  companyApprovals,
  hqApprovals,
  userRole,
}: ApprovalListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'company' | 'hq'>('company')
  const [dialog, setDialog] = useState<DialogState>({
    mode: null,
    application: null,
    level: 'company',
  })
  const [comment, setComment] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [finalAmount, setFinalAmount] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dialogAttachments, setDialogAttachments] = useState<AttachmentInfo[]>([])

  const showHqTab = userRole === 'admin'
  const currentApprovals = activeTab === 'company' ? companyApprovals : hqApprovals

  function loadAttachments(applicationId: string) {
    setDialogAttachments([])
    getAttachments(applicationId).then(setDialogAttachments)
  }

  function openApproveDialog(app: Application, level: 'company' | 'hq') {
    setDialog({ mode: 'approve', application: app, level })
    setComment('')
    setFinalAmount(level === 'hq' ? String(app.calculated_amount) : '')
    setMessage(null)
    loadAttachments(app.application_id)
  }

  function openRejectDialog(app: Application, level: 'company' | 'hq') {
    setDialog({ mode: 'reject', application: app, level })
    setRejectReason('')
    setMessage(null)
    loadAttachments(app.application_id)
  }

  function closeDialog() {
    setDialog({ mode: null, application: null, level: 'company' })
    setComment('')
    setRejectReason('')
    setFinalAmount('')
    setDialogAttachments([])
  }

  function isImage(name: string) {
    return /\.(jpg|jpeg|png)$/i.test(name)
  }

  async function handleApprove() {
    if (!dialog.application) return

    const appId = dialog.application.application_id
    let result: { success: true } | { success: false; error: string }

    if (dialog.level === 'hq') {
      const amt = finalAmount ? Number(finalAmount) : undefined
      result = await approveByHQ(appId, comment || undefined, amt)
    } else {
      result = await approveByCompany(appId, comment || undefined)
    }

    if (result.success) {
      setMessage({ type: 'success', text: '承認が完了しました' })
      closeDialog()
      startTransition(() => {
        router.refresh()
      })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  async function handleReject() {
    if (!dialog.application) return
    if (!rejectReason.trim()) {
      setMessage({ type: 'error', text: '差戻し理由を入力してください' })
      return
    }

    const result = await rejectApplication(
      dialog.application.application_id,
      rejectReason,
      dialog.level
    )

    if (result.success) {
      setMessage({ type: 'success', text: '差戻しが完了しました' })
      closeDialog()
      startTransition(() => {
        router.refresh()
      })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  return (
    <div className="space-y-4">
      {/* Inline message */}
      {message && (
        <div
          className={`px-4 py-3 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('company')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'company'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          各社承認待ち
          {companyApprovals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
              {companyApprovals.length}
            </span>
          )}
        </button>
        {showHqTab && (
          <button
            onClick={() => setActiveTab('hq')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === 'hq'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            本部承認待ち
            {hqApprovals.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                {hqApprovals.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Table */}
      {currentApprovals.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          承認待ちの申請はありません
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">申請ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">申請日</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">会員名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">会社</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">給付金種別</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">金額</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">アクション</th>
              </tr>
            </thead>
            <tbody>
              {currentApprovals.map((app) => (
                <tr key={app.application_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {app.application_id}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {formatDate(app.application_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {app.member_name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {app.company_name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {app.benefit_type_name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 font-medium">
                    {formatCurrency(app.calculated_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                        app.status
                      )}`}
                    >
                      {getStatusLabel(app.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openApproveDialog(app, activeTab)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => openRejectDialog(app, activeTab)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition"
                      >
                        差戻し
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve Dialog */}
      {dialog.mode === 'approve' && dialog.application && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {dialog.level === 'hq' ? '本部承認' : '各社承認'}
            </h3>

            <div className="space-y-3 mb-4">
              <div className="text-sm">
                <span className="text-gray-500">申請ID: </span>
                <span className="font-mono text-gray-800">
                  {dialog.application.application_id}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">会員名: </span>
                <span className="text-gray-800">{dialog.application.member_name}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">給付金種別: </span>
                <span className="text-gray-800">{dialog.application.benefit_type_name}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">計算金額: </span>
                <span className="text-gray-800 font-medium">
                  {formatCurrency(dialog.application.calculated_amount)}
                </span>
              </div>
            </div>

            {/* 添付ファイル */}
            {dialogAttachments.length > 0 && (
              <div className="mb-4 border-t border-gray-200 pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Paperclip className="w-4 h-4" />
                  添付ファイル（{dialogAttachments.length}件）
                </p>
                <div className="space-y-1.5">
                  {dialogAttachments.map(att => (
                    <a
                      key={att.path}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-sm text-blue-600 hover:bg-blue-50 transition"
                    >
                      {isImage(att.name) ? (
                        <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span className="truncate">{att.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {dialog.level === 'hq' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最終金額（変更する場合のみ）
                </label>
                <input
                  type="number"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="計算金額のまま承認する場合は空欄"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                コメント（任意）
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="承認に関するコメントがあれば入力してください"
              />
            </div>

            {message && message.type === 'error' && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                {message.text}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDialog}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition disabled:opacity-50"
              >
                {isPending ? '処理中...' : '承認する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {dialog.mode === 'reject' && dialog.application && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">差戻し</h3>

            <div className="space-y-3 mb-4">
              <div className="text-sm">
                <span className="text-gray-500">申請ID: </span>
                <span className="font-mono text-gray-800">
                  {dialog.application.application_id}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">会員名: </span>
                <span className="text-gray-800">{dialog.application.member_name}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">給付金種別: </span>
                <span className="text-gray-800">{dialog.application.benefit_type_name}</span>
              </div>
            </div>

            {/* 添付ファイル */}
            {dialogAttachments.length > 0 && (
              <div className="mb-4 border-t border-gray-200 pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Paperclip className="w-4 h-4" />
                  添付ファイル（{dialogAttachments.length}件）
                </p>
                <div className="space-y-1.5">
                  {dialogAttachments.map(att => (
                    <a
                      key={att.path}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2 text-sm text-blue-600 hover:bg-blue-50 transition"
                    >
                      {isImage(att.name) ? (
                        <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span className="truncate">{att.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                差戻し理由 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                placeholder="差戻しの理由を入力してください（必須）"
              />
            </div>

            {message && message.type === 'error' && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                {message.text}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeDialog}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition disabled:opacity-50"
              >
                {isPending ? '処理中...' : '差戻しする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
