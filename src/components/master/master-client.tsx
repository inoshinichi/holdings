'use client'

import { useState, useTransition } from 'react'
import type { Company, Approver, BenefitType, AuditLog, FeeSetting } from '@/types/database'
import { upsertCompany, upsertApprover, updateFeeSetting } from '@/lib/actions/master'
import { formatDateTime } from '@/lib/utils/date'
import {
  Building2, UserCheck, Gift, FileText, DollarSign,
  Plus, Pencil, X, Save, Loader2
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MasterClientProps {
  initialCompanies: Company[]
  initialApprovers: Approver[]
  initialBenefitTypes: BenefitType[]
  initialAuditLogs: AuditLog[]
  initialFeeSettings: FeeSetting[]
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabKey = 'companies' | 'approvers' | 'benefits' | 'fees' | 'logs'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'companies', label: '会社マスター', icon: Building2 },
  { key: 'approvers', label: '承認者マスター', icon: UserCheck },
  { key: 'benefits', label: '給付金マスター', icon: Gift },
  { key: 'fees', label: '会費設定', icon: DollarSign },
  { key: 'logs', label: '操作ログ', icon: FileText },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MasterClient({
  initialCompanies,
  initialApprovers,
  initialBenefitTypes,
  initialAuditLogs,
  initialFeeSettings,
}: MasterClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('companies')

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">マスター管理</h2>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'companies' && (
        <CompaniesTab
          companies={initialCompanies}
        />
      )}
      {activeTab === 'approvers' && (
        <ApproversTab
          approvers={initialApprovers}
          companies={initialCompanies}
        />
      )}
      {activeTab === 'benefits' && (
        <BenefitTypesTab benefitTypes={initialBenefitTypes} />
      )}
      {activeTab === 'fees' && (
        <FeeSettingsTab feeSettings={initialFeeSettings} />
      )}
      {activeTab === 'logs' && (
        <AuditLogsTab logs={initialAuditLogs} />
      )}
    </div>
  )
}

// ===========================================================================
// Tab 1 - Companies
// ===========================================================================

function CompaniesTab({ companies: initialList }: { companies: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initialList)
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const emptyCompany: Partial<Company> & { company_code: string } = {
    company_code: '',
    company_name: '',
    company_name_kana: '',
    postal_code: '',
    address: '',
    phone: '',
    contact_name: '',
    contact_email: '',
    is_active: true,
  }

  const [formData, setFormData] = useState(emptyCompany)

  function handleEdit(company: Company) {
    setIsAdding(false)
    setEditingCode(company.company_code)
    setFormData({ ...company })
    setError(null)
    setSuccessMsg(null)
  }

  function handleAdd() {
    setEditingCode(null)
    setIsAdding(true)
    setFormData({ ...emptyCompany })
    setError(null)
    setSuccessMsg(null)
  }

  function handleCancel() {
    setEditingCode(null)
    setIsAdding(false)
    setError(null)
  }

  function handleSave() {
    if (!formData.company_code.trim()) {
      setError('会社コードは必須です')
      return
    }
    if (!formData.company_name?.trim()) {
      setError('会社名は必須です')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await upsertCompany(formData)
      if (result.success) {
        // Update local state
        const idx = companies.findIndex(c => c.company_code === formData.company_code)
        const updatedCompany: Company = {
          company_code: formData.company_code,
          company_name: formData.company_name ?? '',
          company_name_kana: formData.company_name_kana ?? null,
          postal_code: formData.postal_code ?? null,
          address: formData.address ?? null,
          phone: formData.phone ?? null,
          contact_name: formData.contact_name ?? null,
          contact_email: formData.contact_email ?? null,
          approver_id: formData.approver_id ?? null,
          is_active: formData.is_active ?? true,
          created_at: idx >= 0 ? companies[idx].created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (idx >= 0) {
          const updated = [...companies]
          updated[idx] = updatedCompany
          setCompanies(updated)
        } else {
          setCompanies([...companies, updatedCompany])
        }

        setEditingCode(null)
        setIsAdding(false)
        setSuccessMsg('保存しました')
        setTimeout(() => setSuccessMsg(null), 3000)
      } else {
        setError(result.error ?? '保存に失敗しました')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{companies.length} 件</p>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          新規追加
        </button>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Inline add form */}
      {isAdding && (
        <CompanyForm
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={isPending}
          error={error}
          isNew
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">会社コード</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">会社名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">連絡先</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">電話番号</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">有効</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    会社マスターが登録されていません
                  </td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr key={company.company_code} className="hover:bg-gray-50 transition">
                    {editingCode === company.company_code ? (
                      <td colSpan={6} className="p-0">
                        <CompanyForm
                          formData={formData}
                          setFormData={setFormData}
                          onSave={handleSave}
                          onCancel={handleCancel}
                          isPending={isPending}
                          error={error}
                          isNew={false}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {company.company_code}
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium">
                          {company.company_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {company.contact_name ?? '-'}
                          {company.contact_email && (
                            <span className="ml-2 text-xs text-gray-400">{company.contact_email}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {company.phone ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              company.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {company.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleEdit(company)}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            編集
                          </button>
                        </td>
                      </>
                    )}
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

// ---------------------------------------------------------------------------
// Company Form (shared by add & edit)
// ---------------------------------------------------------------------------

function CompanyForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  isPending,
  error,
  isNew,
}: {
  formData: Partial<Company> & { company_code: string }
  setFormData: (d: Partial<Company> & { company_code: string }) => void
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string | null
  isNew: boolean
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">
        {isNew ? '会社を新規追加' : '会社を編集'}
      </h4>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">会社コード *</label>
          <input
            type="text"
            value={formData.company_code}
            onChange={e => setFormData({ ...formData, company_code: e.target.value })}
            disabled={!isNew}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">会社名 *</label>
          <input
            type="text"
            value={formData.company_name ?? ''}
            onChange={e => setFormData({ ...formData, company_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">会社名カナ</label>
          <input
            type="text"
            value={formData.company_name_kana ?? ''}
            onChange={e => setFormData({ ...formData, company_name_kana: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
          <input
            type="text"
            value={formData.postal_code ?? ''}
            onChange={e => setFormData({ ...formData, postal_code: e.target.value })}
            placeholder="000-0000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">住所</label>
          <input
            type="text"
            value={formData.address ?? ''}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">電話番号</label>
          <input
            type="text"
            value={formData.phone ?? ''}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
          <input
            type="text"
            value={formData.contact_name ?? ''}
            onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">担当者メール</label>
          <input
            type="email"
            value={formData.contact_email ?? ''}
            onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">有効</label>
          <select
            value={formData.is_active ? 'true' : 'false'}
            onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <X className="w-4 h-4" />
          キャンセル
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// Tab 2 - Approvers
// ===========================================================================

function ApproversTab({
  approvers: initialList,
  companies,
}: {
  approvers: Approver[]
  companies: Company[]
}) {
  const [approvers, setApprovers] = useState<Approver[]>(initialList)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const emptyApprover: Partial<Approver> & { approver_id: string } = {
    approver_id: '',
    full_name: '',
    email: '',
    company_code: companies[0]?.company_code ?? '',
    permission_level: 'company',
    is_active: true,
  }

  const [formData, setFormData] = useState(emptyApprover)

  function handleEdit(approver: Approver) {
    setIsAdding(false)
    setEditingId(approver.approver_id)
    setFormData({ ...approver })
    setError(null)
    setSuccessMsg(null)
  }

  function handleAdd() {
    setEditingId(null)
    setIsAdding(true)
    setFormData({ ...emptyApprover })
    setError(null)
    setSuccessMsg(null)
  }

  function handleCancel() {
    setEditingId(null)
    setIsAdding(false)
    setError(null)
  }

  function handleSave() {
    if (!formData.approver_id.trim()) {
      setError('承認者IDは必須です')
      return
    }
    if (!formData.full_name?.trim()) {
      setError('氏名は必須です')
      return
    }
    if (!formData.email?.trim()) {
      setError('メールアドレスは必須です')
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await upsertApprover(formData)
      if (result.success) {
        const idx = approvers.findIndex(a => a.approver_id === formData.approver_id)
        const updatedApprover: Approver = {
          approver_id: formData.approver_id,
          full_name: formData.full_name ?? '',
          email: formData.email ?? '',
          company_code: formData.company_code ?? '',
          permission_level: formData.permission_level ?? 'company',
          is_active: formData.is_active ?? true,
          created_at: idx >= 0 ? approvers[idx].created_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (idx >= 0) {
          const updated = [...approvers]
          updated[idx] = updatedApprover
          setApprovers(updated)
        } else {
          setApprovers([...approvers, updatedApprover])
        }

        setEditingId(null)
        setIsAdding(false)
        setSuccessMsg('保存しました')
        setTimeout(() => setSuccessMsg(null), 3000)
      } else {
        setError(result.error ?? '保存に失敗しました')
      }
    })
  }

  const PERMISSION_LABELS: Record<string, string> = {
    hq: '本部',
    company: '各社',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{approvers.length} 件</p>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          新規追加
        </button>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Inline add form */}
      {isAdding && (
        <ApproverForm
          formData={formData}
          setFormData={setFormData}
          companies={companies}
          onSave={handleSave}
          onCancel={handleCancel}
          isPending={isPending}
          error={error}
          isNew
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">承認者ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">氏名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">メール</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">会社コード</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">権限レベル</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">有効</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {approvers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    承認者が登録されていません
                  </td>
                </tr>
              ) : (
                approvers.map(approver => (
                  <tr key={approver.approver_id} className="hover:bg-gray-50 transition">
                    {editingId === approver.approver_id ? (
                      <td colSpan={7} className="p-0">
                        <ApproverForm
                          formData={formData}
                          setFormData={setFormData}
                          companies={companies}
                          onSave={handleSave}
                          onCancel={handleCancel}
                          isPending={isPending}
                          error={error}
                          isNew={false}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {approver.approver_id}
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium">
                          {approver.full_name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {approver.email}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {approver.company_code}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              approver.permission_level === 'hq'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {PERMISSION_LABELS[approver.permission_level] ?? approver.permission_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              approver.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {approver.is_active ? '有効' : '無効'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleEdit(approver)}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            編集
                          </button>
                        </td>
                      </>
                    )}
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

// ---------------------------------------------------------------------------
// Approver Form
// ---------------------------------------------------------------------------

function ApproverForm({
  formData,
  setFormData,
  companies,
  onSave,
  onCancel,
  isPending,
  error,
  isNew,
}: {
  formData: Partial<Approver> & { approver_id: string }
  setFormData: (d: Partial<Approver> & { approver_id: string }) => void
  companies: Company[]
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  error: string | null
  isNew: boolean
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">
        {isNew ? '承認者を新規追加' : '承認者を編集'}
      </h4>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">承認者ID *</label>
          <input
            type="text"
            value={formData.approver_id}
            onChange={e => setFormData({ ...formData, approver_id: e.target.value })}
            disabled={!isNew}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">氏名 *</label>
          <input
            type="text"
            value={formData.full_name ?? ''}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス *</label>
          <input
            type="email"
            value={formData.email ?? ''}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">会社コード</label>
          <select
            value={formData.company_code ?? ''}
            onChange={e => setFormData({ ...formData, company_code: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {companies.map(c => (
              <option key={c.company_code} value={c.company_code}>
                {c.company_code} - {c.company_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">権限レベル</label>
          <select
            value={formData.permission_level ?? 'company'}
            onChange={e =>
              setFormData({
                ...formData,
                permission_level: e.target.value as 'hq' | 'company',
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="company">各社</option>
            <option value="hq">本部</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">有効</label>
          <select
            value={formData.is_active ? 'true' : 'false'}
            onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          保存
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <X className="w-4 h-4" />
          キャンセル
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// Tab 3 - Benefit Types (read-only)
// ===========================================================================

function BenefitTypesTab({ benefitTypes }: { benefitTypes: BenefitType[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{benefitTypes.length} 件</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">コード</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">説明</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">必要書類</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">有効</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benefitTypes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    給付金種別が登録されていません
                  </td>
                </tr>
              ) : (
                benefitTypes.map(bt => (
                  <tr key={bt.benefit_type_code} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {bt.benefit_type_code}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {bt.benefit_type_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {bt.description ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {bt.required_documents ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          bt.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {bt.is_active ? '有効' : '無効'}
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

// ===========================================================================
// Tab 4 - Audit Logs (read-only)
// ===========================================================================

function AuditLogsTab({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">直近 {logs.length} 件</p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">日時</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ユーザー</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">対象</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    操作ログがありません
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.user_email ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 font-medium">
                      {log.operation_type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {log.target ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-sm truncate">
                      {log.details ?? '-'}
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

// ---------------------------------------------------------------------------
// Fee Settings Tab
// ---------------------------------------------------------------------------

function FeeSettingsTab({ feeSettings }: { feeSettings: FeeSetting[] }) {
  const [items, setItems] = useState(feeSettings)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function startEdit(item: FeeSetting) {
    setEditingCategory(item.category)
    setEditAmount(String(item.amount))
    setMessage(null)
  }

  function cancelEdit() {
    setEditingCategory(null)
    setEditAmount('')
  }

  function handleSave(category: string) {
    const amount = parseInt(editAmount, 10)
    if (isNaN(amount) || amount < 0) {
      setMessage({ type: 'error', text: '有効な金額を入力してください' })
      return
    }

    startTransition(async () => {
      const result = await updateFeeSetting(category, amount)
      if (result.success) {
        setItems(prev => prev.map(i => i.category === category ? { ...i, amount } : i))
        setEditingCategory(null)
        setMessage({ type: 'success', text: `${category}の会費を${amount.toLocaleString()}円に更新しました` })
      } else {
        setMessage({ type: 'error', text: result.error ?? '更新に失敗しました' })
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        会員区分ごとの月額会費を設定します。変更は次回の会費データ生成から反映されます。
      </p>

      {message && (
        <div className={`px-4 py-3 rounded text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-600">会費区分</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">月額（円）</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.category} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800 font-medium">{item.category}</td>
                <td className="px-4 py-3 text-right">
                  {editingCategory === item.category ? (
                    <input
                      type="number"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      min={0}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <span className="text-gray-800 font-medium tabular-nums">
                      {item.amount.toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {editingCategory === item.category ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleSave(item.category)}
                        disabled={isPending}
                        className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                      <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
