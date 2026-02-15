'use client'

import { useEffect, useState, useTransition } from 'react'
import { getWorkflowAssignments, assignCompanyApprover } from '@/lib/actions/workflow'
import type { Approver, Company } from '@/types/database'
import { GitBranch, ArrowRight, User, Building2, Shield, CheckCircle } from 'lucide-react'

export default function WorkflowPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [approvers, setApprovers] = useState<Approver[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const data = await getWorkflowAssignments()
      setCompanies(data.companies)
      setApprovers(data.approvers)
      setLoading(false)
    }
    load()
  }, [])

  async function reload() {
    const data = await getWorkflowAssignments()
    setCompanies(data.companies)
    setApprovers(data.approvers)
  }

  function handleAssign(companyCode: string, approverId: string) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await assignCompanyApprover(companyCode, approverId || null)
      if (result.success) {
        setMessage('承認者を更新しました')
        await reload()
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>
  }

  const companyApprovers = approvers.filter(a => a.permission_level === 'company')
  const hqApprovers = approvers.filter(a => a.permission_level === 'hq')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch className="w-6 h-6 text-gray-600" />
        <h2 className="text-xl font-bold text-gray-800">承認ワークフロー設定</h2>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

      {/* Workflow diagram */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-800 mb-4">承認フロー</h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <User className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">会員（申請者）</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">各社承認者</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg border border-purple-200">
            <Shield className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">本部承認者</span>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">支払完了</span>
          </div>
        </div>
      </div>

      {/* Company approver assignments */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-base font-bold text-gray-800">各社承認者の割り当て</h3>
          <p className="text-xs text-gray-500 mt-1">各会社の申請を最初に承認する担当者を設定します</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-600">会社コード</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">会社名</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">各社承認者</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map(company => {
                // Find approvers for this company
                const availableApprovers = companyApprovers.filter(
                  a => a.company_code === company.company_code
                )
                // Also include all HQ approvers as they can approve any company
                const allAvailable = [...availableApprovers, ...hqApprovers]

                return (
                  <tr key={company.company_code} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-xs text-gray-600">{company.company_code}</td>
                    <td className="px-6 py-3 text-gray-800 font-medium">{company.company_name}</td>
                    <td className="px-6 py-3">
                      <select
                        className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={company.approver_id || ''}
                        onChange={e => handleAssign(company.company_code, e.target.value)}
                        disabled={isPending}
                      >
                        <option value="">未設定</option>
                        {allAvailable.map(a => (
                          <option key={a.approver_id} value={a.approver_id}>
                            {a.full_name}（{a.email}）{a.permission_level === 'hq' ? ' [本部]' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* HQ Approvers */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-base font-bold text-gray-800">本部承認者</h3>
          <p className="text-xs text-gray-500 mt-1">各社承認後の最終承認を行う担当者（マスター管理で登録）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-600">氏名</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">メールアドレス</th>
                <th className="px-6 py-3 text-center font-medium text-gray-600">権限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hqApprovers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                    本部承認者が登録されていません
                  </td>
                </tr>
              ) : (
                hqApprovers.map(a => (
                  <tr key={a.approver_id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800 font-medium">{a.full_name}</td>
                    <td className="px-6 py-3 text-gray-600">{a.email}</td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                        本部
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company-level approvers list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-base font-bold text-gray-800">各社承認者一覧</h3>
          <p className="text-xs text-gray-500 mt-1">各会社の承認を担当する承認者（マスター管理で登録）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-600">氏名</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">メールアドレス</th>
                <th className="px-6 py-3 text-left font-medium text-gray-600">担当会社</th>
                <th className="px-6 py-3 text-center font-medium text-gray-600">権限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companyApprovers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    各社承認者が登録されていません
                  </td>
                </tr>
              ) : (
                companyApprovers.map(a => (
                  <tr key={a.approver_id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800 font-medium">{a.full_name}</td>
                    <td className="px-6 py-3 text-gray-600">{a.email}</td>
                    <td className="px-6 py-3 text-gray-600">{a.company_code}</td>
                    <td className="px-6 py-3 text-center">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                        各社
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
