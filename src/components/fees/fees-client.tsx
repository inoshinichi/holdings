'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/format'
import {
  generateMonthlyFees,
  recordFeePayment,
  markFeesAsInvoiced,
} from '@/lib/actions/fees'
import type { MonthlyFee } from '@/types/database'

interface FeeSummary {
  yearMonth: string
  totalCompanies: number
  totalMembers: number
  totalFee: number
  paidAmount: number
  unpaidAmount: number
  paidCompanies: number
  unpaidCompanies: number
}

interface FeesClientProps {
  fees: MonthlyFee[]
  summary: FeeSummary
  currentYearMonth: string
}

const FEE_STATUS_COLORS: Record<string, string> = {
  '未請求': 'bg-gray-100 text-gray-700',
  '請求済': 'bg-yellow-100 text-yellow-700',
  '一部入金': 'bg-orange-100 text-orange-700',
  '入金完了': 'bg-green-100 text-green-700',
}

function getFeeStatusColor(status: string): string {
  return FEE_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'
}

export function FeesClient({ fees, summary, currentYearMonth }: FeesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [yearMonth, setYearMonth] = useState(currentYearMonth)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean
    fee: MonthlyFee | null
  }>({ open: false, fee: null })
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')

  function handleYearMonthChange(value: string) {
    setYearMonth(value)
    setSelectedIds(new Set())
    setMessage(null)
    startTransition(() => {
      router.push(`/fees?yearMonth=${value}`)
    })
  }

  async function handleGenerate() {
    setMessage(null)
    const result = await generateMonthlyFees(yearMonth)
    if (result.success) {
      setMessage({
        type: 'success',
        text: `${yearMonth} の会費データを生成しました。対象企業数: ${result.companyCount}`,
      })
      startTransition(() => {
        router.refresh()
      })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  async function handleMarkInvoiced() {
    if (selectedIds.size === 0) {
      setMessage({ type: 'error', text: '請求済にする行を選択してください' })
      return
    }
    setMessage(null)
    const result = await markFeesAsInvoiced(Array.from(selectedIds))
    if (result.success) {
      setMessage({ type: 'success', text: `${selectedIds.size}件を請求済に更新しました` })
      setSelectedIds(new Set())
      startTransition(() => {
        router.refresh()
      })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  function openPaymentDialog(fee: MonthlyFee) {
    setPaymentDialog({ open: true, fee })
    setPaymentAmount(String(fee.total_fee))
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setMessage(null)
  }

  function closePaymentDialog() {
    setPaymentDialog({ open: false, fee: null })
    setPaymentAmount('')
    setPaymentDate('')
  }

  async function handleRecordPayment() {
    if (!paymentDialog.fee) return
    const amount = Number(paymentAmount)
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: '有効な入金額を入力してください' })
      return
    }

    setMessage(null)
    const result = await recordFeePayment(
      paymentDialog.fee.id,
      amount,
      paymentDate || undefined
    )
    if (result.success) {
      setMessage({ type: 'success', text: '入金記録を登録しました' })
      closePaymentDialog()
      startTransition(() => {
        router.refresh()
      })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSelectAll() {
    const invoiceableIds = fees
      .filter((f) => f.status === '未請求')
      .map((f) => f.id)

    if (invoiceableIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(invoiceableIds))
    }
  }

  const invoiceableFees = fees.filter((f) => f.status === '未請求')
  const allInvoiceableSelected =
    invoiceableFees.length > 0 &&
    invoiceableFees.every((f) => selectedIds.has(f.id))

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">対象年月</label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => handleYearMonthChange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
          >
            {isPending ? '処理中...' : '会費データ生成'}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleMarkInvoiced}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded transition disabled:opacity-50"
            >
              請求済にする ({selectedIds.size}件)
            </button>
          )}
        </div>
      </div>

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard label="対象企業数" value={`${summary.totalCompanies}社`} color="text-blue-600 bg-blue-50" />
        <SummaryCard label="会員数" value={`${summary.totalMembers}名`} color="text-purple-600 bg-purple-50" />
        <SummaryCard label="請求額合計" value={formatCurrency(summary.totalFee)} color="text-gray-700 bg-gray-50" />
        <SummaryCard label="入金額合計" value={formatCurrency(summary.paidAmount)} color="text-green-600 bg-green-50" />
        <SummaryCard label="未入金額" value={formatCurrency(summary.unpaidAmount)} color="text-red-600 bg-red-50" />
      </div>

      {/* Fee Table */}
      {fees.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {yearMonth} の会費データはありません。「会費データ生成」ボタンで作成してください。
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allInvoiceableSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    title="未請求を全て選択"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">会社名</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">会員数</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">一般</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">係長以上</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">部長職以上</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">休会</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">合計金額</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">入金額</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">アクション</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => {
                const isInvoiceable = fee.status === '未請求'
                return (
                  <tr
                    key={fee.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-center">
                      {isInvoiceable ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(fee.id)}
                          onChange={() => toggleSelect(fee.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{fee.company_name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fee.member_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fee.general_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fee.chief_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fee.manager_count}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fee.leave_count}</td>
                    <td className="px-4 py-3 text-right text-gray-800 font-medium">
                      {formatCurrency(fee.total_fee)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fee.paid_amount != null ? formatCurrency(fee.paid_amount) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getFeeStatusColor(
                          fee.status
                        )}`}
                      >
                        {fee.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`/api/invoice-pdf?feeId=${fee.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition"
                        >
                          請求書
                        </a>
                        <button
                          onClick={() => openPaymentDialog(fee)}
                          disabled={fee.status === '入金完了'}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          入金記録
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Dialog */}
      {paymentDialog.open && paymentDialog.fee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">入金記録</h3>

            <div className="space-y-3 mb-4">
              <div className="text-sm">
                <span className="text-gray-500">会社名: </span>
                <span className="text-gray-800">{paymentDialog.fee.company_name}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">請求額: </span>
                <span className="text-gray-800 font-medium">
                  {formatCurrency(paymentDialog.fee.total_fee)}
                </span>
              </div>
              {paymentDialog.fee.paid_amount != null && paymentDialog.fee.paid_amount > 0 && (
                <div className="text-sm">
                  <span className="text-gray-500">既入金額: </span>
                  <span className="text-gray-800">
                    {formatCurrency(paymentDialog.fee.paid_amount)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  入金額 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="入金額を入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  入金日
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {message && message.type === 'error' && (
              <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                {message.text}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closePaymentDialog}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition disabled:opacity-50"
              >
                {isPending ? '処理中...' : '入金を記録'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Small helper component ---------- */

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color.split(' ')[0]}`}>{value}</p>
    </div>
  )
}
