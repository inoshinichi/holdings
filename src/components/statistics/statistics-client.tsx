'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils/format'
import { FileBarChart, Banknote } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BenefitStatistics {
  summary: { totalCount: number; totalAmount: number }
  byType: Array<{
    code: string
    name: string
    count: number
    amount: number
    avgAmount: number
  }>
  byMonth: Array<{ month: string; count: number; amount: number }>
  byCompany: Array<{
    companyCode: string
    companyName: string
    count: number
    amount: number
  }>
}

interface Props {
  initialData: BenefitStatistics
  initialStartDate: string
  initialEndDate: string
  companyCode?: string
}

export function StatisticsClient({
  initialData,
  initialStartDate,
  initialEndDate,
  companyCode,
}: Props) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const data = initialData

  // ------- Date filter submit -------
  const handleFilter = () => {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    router.push(`/statistics?${params.toString()}`)
  }

  // approverの場合は「会社別」セクションは自社のみなので非表示
  const showCompanyTable = !companyCode

  // ------- Custom tooltip for chart -------
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-blue-600">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }

  // ------- Stat cards -------
  const summaryCards = [
    {
      label: '総件数',
      value: `${data.summary.totalCount.toLocaleString()} 件`,
      icon: FileBarChart,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: '総額',
      value: formatCurrency(data.summary.totalAmount),
      icon: Banknote,
      color: 'text-green-600 bg-green-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page title */}
      <h2 className="text-xl font-bold text-gray-800">給付金統計</h2>

      {/* Date range selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">開始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">終了日</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleFilter}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
          >
            検索
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4"
            >
              <div className={`p-3 rounded-lg ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Benefit type table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-700">
            給付金種別
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  種別コード
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  名称
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  件数
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  金額
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  平均金額
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byType.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    データがありません
                  </td>
                </tr>
              ) : (
                data.byType.map((row) => (
                  <tr
                    key={row.code}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {row.code}
                    </td>
                    <td className="px-4 py-3 text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-right text-gray-800">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(row.avgAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-700">月別推移</h3>
        </div>
        <div className="p-4">
          {data.byMonth.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              データがありません
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={data.byMonth}
                margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="amount"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Company table */}
      {showCompanyTable && <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-700">会社別</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  会社コード
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  会社名
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  件数
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  金額
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.byCompany.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    データがありません
                  </td>
                </tr>
              ) : (
                data.byCompany.map((row) => (
                  <tr
                    key={row.companyCode}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {row.companyCode}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {row.companyName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}
    </div>
  )
}
