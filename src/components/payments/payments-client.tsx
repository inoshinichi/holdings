'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import { markPaymentsAsExported } from '@/lib/actions/payments'
import type { Payment } from '@/types/database'
import type { PaymentStats } from '@/lib/actions/payments'
import {
  CreditCard,
  Clock,
  Banknote,
  AlertCircle,
  Download,
  CheckCircle2,
} from 'lucide-react'

type FilterTab = 'all' | 'pending' | 'exported'

interface Props {
  initialStats: PaymentStats
  initialPayments: Payment[]
}

export function PaymentsClient({ initialStats, initialPayments }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const stats = initialStats
  const payments = initialPayments

  // ------- Filtered list based on active tab -------
  const filteredPayments = payments.filter((p) => {
    if (activeTab === 'pending') return p.zengin_export_date === null
    if (activeTab === 'exported') return p.zengin_export_date !== null
    return true
  })

  // Only pending payments can be selected for CSV export
  const pendingPayments = filteredPayments.filter(
    (p) => p.zengin_export_date === null,
  )

  // ------- Selection helpers -------
  const toggleSelect = (id: string) => {
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

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingPayments.length && pendingPayments.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingPayments.map((p) => p.payment_id)))
    }
  }

  // ------- Zengin CSV download & mark -------
  const handleExport = async () => {
    if (selectedIds.size === 0) return
    setError(null)
    setSuccessMessage(null)
    setIsExporting(true)

    try {
      const paymentIds = Array.from(selectedIds)

      // 1. Download CSV from API
      const res = await fetch('/api/zengin-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? '全銀CSVの生成に失敗しました')
      }

      // Trigger browser download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/)
      a.download = filenameMatch?.[1] ?? 'zengin.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      // 2. Mark as exported
      const markResult = await markPaymentsAsExported(paymentIds)
      if (!markResult.success) {
        throw new Error(markResult.error)
      }

      setSelectedIds(new Set())
      setSuccessMessage(`${paymentIds.length}件の全銀CSVを出力しました`)

      // Refresh data from server
      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '全銀CSV出力中にエラーが発生しました',
      )
    } finally {
      setIsExporting(false)
    }
  }

  // ------- Tab definitions -------
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '全て' },
    { key: 'pending', label: '未振込' },
    { key: 'exported', label: '振込済' },
  ]

  // ------- Stat cards -------
  const statCards = [
    {
      label: '総件数',
      value: String(stats.totalCount),
      icon: CreditCard,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: '未振込件数',
      value: String(stats.pendingCount),
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      label: '総額',
      value: formatCurrency(stats.totalAmount),
      icon: Banknote,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: '未振込額',
      value: formatCurrency(stats.pendingAmount),
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
    },
  ]

  // ------- Helper: format account info -------
  const formatAccount = (p: Payment) => {
    if (!p.bank_code && !p.account_number) return '-'
    const parts: string[] = []
    if (p.bank_code) parts.push(p.bank_code)
    if (p.branch_code) parts.push(p.branch_code)
    if (p.account_type) parts.push(p.account_type)
    if (p.account_number) parts.push(p.account_number)
    return parts.join(' / ')
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">支払管理</h2>
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

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {/* Tabs + CSV export button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                setSelectedIds(new Set())
              }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={handleExport}
            disabled={isExporting || isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting
              ? '出力中...'
              : `全銀CSVダウンロード (${selectedIds.size}件)`}
          </button>
        )}
      </div>

      {/* Payments table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Checkbox column */}
                <th className="px-4 py-3 w-10">
                  {pendingPayments.length > 0 && (
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === pendingPayments.length &&
                        pendingPayments.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  )}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  支払ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  申請ID
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  会員名
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  給付金種別
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  金額
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  支払日
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  口座情報
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  全銀CSV出力日
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    該当する支払データがありません
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const isPendingPayment = payment.zengin_export_date === null
                  return (
                    <tr
                      key={payment.payment_id}
                      className="hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3">
                        {isPendingPayment && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(payment.payment_id)}
                            onChange={() => toggleSelect(payment.payment_id)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-mono text-xs">
                        {payment.payment_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-blue-600 font-mono text-xs">
                        {payment.application_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        {payment.member_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {payment.benefit_type}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {formatCurrency(payment.payment_amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(payment.payment_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatAccount(payment)}
                      </td>
                      <td className="px-4 py-3">
                        {payment.zengin_export_date ? (
                          <span className="text-gray-400 text-xs">
                            {formatDate(payment.zengin_export_date)}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            未出力
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Row count footer */}
        {filteredPayments.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500">
            {filteredPayments.length} 件表示
          </div>
        )}
      </div>
    </div>
  )
}
