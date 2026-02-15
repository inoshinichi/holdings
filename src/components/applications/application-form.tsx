'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createApplication } from '@/lib/actions/applications'
import { getMember } from '@/lib/actions/members'
import { calculateBenefit } from '@/lib/calculations/benefit-calculator'
import { BENEFIT_TYPE_LIST } from '@/lib/constants/benefit-types'
import { formatCurrency } from '@/lib/utils/format'
import type { Member, CalculationParams, BenefitCalculationResult } from '@/types/database'
import { uploadAttachment } from '@/lib/actions/attachments'
import { Search, Send, Loader2, CheckCircle2, AlertCircle, Calculator, Paperclip, Trash2, FileText, Image as ImageIcon } from 'lucide-react'

// ---------------------------------------------------------------------------
// Dynamic field definitions per benefit type
// ---------------------------------------------------------------------------

function MarriageFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">
          挙式日
        </label>
        <input
          id="eventDate"
          type="date"
          value={params.eventDate ?? ''}
          onChange={e => onChange({ eventDate: e.target.value || null })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div className="flex flex-col gap-3 justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={params.isRemarriage ?? false}
            onChange={e => onChange({ isRemarriage: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          再婚
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={params.isForChild ?? false}
            onChange={e => onChange({ isForChild: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          子の結婚
        </label>
      </div>
    </div>
  )
}

function ChildbirthFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="childCount" className="block text-sm font-medium text-gray-700 mb-1">
          出産人数
        </label>
        <input
          id="childCount"
          type="number"
          min={1}
          value={params.childCount ?? 1}
          onChange={e => onChange({ childCount: parseInt(e.target.value, 10) || 1 })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
          <input
            type="checkbox"
            checked={params.isStillbirth ?? false}
            onChange={e => onChange({ isStillbirth: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          死産
        </label>
      </div>
    </div>
  )
}

function SchoolEnrollmentFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div>
      <label htmlFor="schoolType" className="block text-sm font-medium text-gray-700 mb-1">
        学校種別
      </label>
      <select
        id="schoolType"
        value={params.schoolType ?? ''}
        onChange={e => onChange({ schoolType: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">選択してください</option>
        <option value="小学校">小学校</option>
        <option value="中学校">中学校</option>
      </select>
    </div>
  )
}

function IllnessInjuryFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">
          発生日
        </label>
        <input
          id="eventDate"
          type="date"
          value={params.eventDate ?? ''}
          onChange={e => onChange({ eventDate: e.target.value || null })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label htmlFor="absenceDays" className="block text-sm font-medium text-gray-700 mb-1">
          欠勤日数
        </label>
        <input
          id="absenceDays"
          type="number"
          min={0}
          value={params.absenceDays ?? ''}
          onChange={e => onChange({ absenceDays: parseInt(e.target.value, 10) || 0 })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label htmlFor="smr" className="block text-sm font-medium text-gray-700 mb-1">
          標準報酬月額
        </label>
        <input
          id="smr"
          type="number"
          min={0}
          value={params.standardMonthlyRemuneration ?? ''}
          onChange={e =>
            onChange({ standardMonthlyRemuneration: parseInt(e.target.value, 10) || 0 })
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  )
}

function DisasterFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label htmlFor="damageLevel" className="block text-sm font-medium text-gray-700 mb-1">
          被害程度
        </label>
        <select
          id="damageLevel"
          value={params.damageLevel ?? ''}
          onChange={e => onChange({ damageLevel: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">選択してください</option>
          <option value="TOTAL_LOSS">全焼・全壊</option>
          <option value="HALF_BURN">半焼</option>
          <option value="HALF_DAMAGE">半壊</option>
        </select>
      </div>
      <div className="flex flex-col gap-3 justify-end">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={params.isOwnHouse ?? false}
            onChange={e => onChange({ isOwnHouse: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          持ち家
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={params.isHeadOfHousehold ?? false}
            onChange={e => onChange({ isHeadOfHousehold: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          世帯主
        </label>
      </div>
    </div>
  )
}

function CondolenceFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
          続柄
        </label>
        <select
          id="relationship"
          value={params.relationship ?? ''}
          onChange={e => onChange({ relationship: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">選択してください</option>
          <option value="MEMBER">会員本人</option>
          <option value="SPOUSE">配偶者</option>
          <option value="PARENT">親</option>
          <option value="CHILD">子</option>
          <option value="GRANDPARENT_SIBLING">祖父母・兄弟姉妹</option>
        </select>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
          <input
            type="checkbox"
            checked={params.isChiefMourner ?? false}
            onChange={e => onChange({ isChiefMourner: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          喪主
        </label>
      </div>
    </div>
  )
}

function FarewellFields({
  params,
  onChange,
}: {
  params: CalculationParams
  onChange: (p: Partial<CalculationParams>) => void
}) {
  return (
    <div>
      <label htmlFor="withdrawalDate" className="block text-sm font-medium text-gray-700 mb-1">
        脱会日
      </label>
      <input
        id="withdrawalDate"
        type="date"
        value={params.withdrawalDate ?? ''}
        onChange={e => onChange({ withdrawalDate: e.target.value })}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function ApplicationForm({ selfMemberId, approverCompanyCode }: { selfMemberId?: string; approverCompanyCode?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Member
  const [memberIdInput, setMemberIdInput] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const [memberError, setMemberError] = useState('')
  const [memberLoading, setMemberLoading] = useState(false)

  // Auto-load member when selfMemberId is provided (regular member)
  useEffect(() => {
    if (!selfMemberId) return
    setMemberLoading(true)
    getMember(selfMemberId)
      .then(found => {
        if (found) {
          setMember(found)
          setCalcParams(prev => ({
            ...prev,
            memberId: found.member_id,
            standardMonthlyRemuneration: found.standard_monthly_remuneration ?? undefined,
          }))
        } else {
          setMemberError('会員情報の取得に失敗しました')
        }
      })
      .catch(() => {
        setMemberError('会員情報の取得に失敗しました')
      })
      .finally(() => {
        setMemberLoading(false)
      })
  }, [selfMemberId])

  // Form
  const [benefitTypeCode, setBenefitTypeCode] = useState('')
  const [calcParams, setCalcParams] = useState<CalculationParams>({ memberId: '' })

  // Simulation
  const [simulationResult, setSimulationResult] = useState<BenefitCalculationResult | null>(null)
  const [simulationError, setSimulationError] = useState('')

  // Attachments
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')

  // Result
  const [result, setResult] = useState<{
    applicationId: string
    benefitResult: BenefitCalculationResult
  } | null>(null)
  const [submitError, setSubmitError] = useState('')

  // -- Member lookup --
  async function handleMemberSearch() {
    const trimmed = memberIdInput.trim()
    if (!trimmed) return
    setMemberError('')
    setMember(null)
    setMemberLoading(true)
    try {
      const found = await getMember(trimmed, approverCompanyCode)
      if (found) {
        setMember(found)
        setCalcParams(prev => ({
          ...prev,
          memberId: found.member_id,
          standardMonthlyRemuneration: found.standard_monthly_remuneration ?? undefined,
        }))
      } else {
        setMemberError(approverCompanyCode ? '自社の会員が見つかりません' : '会員が見つかりません')
      }
    } catch {
      setMemberError('会員の検索に失敗しました')
    } finally {
      setMemberLoading(false)
    }
  }

  // -- Update calc params helper --
  function updateParams(partial: Partial<CalculationParams>) {
    setCalcParams(prev => ({ ...prev, ...partial }))
  }

  // -- Render dynamic fields based on benefit type --
  function renderDynamicFields() {
    switch (benefitTypeCode) {
      case '01':
        return <MarriageFields params={calcParams} onChange={updateParams} />
      case '02':
        return <ChildbirthFields params={calcParams} onChange={updateParams} />
      case '03':
        return <SchoolEnrollmentFields params={calcParams} onChange={updateParams} />
      case '04':
        return <IllnessInjuryFields params={calcParams} onChange={updateParams} />
      case '05':
        return <DisasterFields params={calcParams} onChange={updateParams} />
      case '06':
        return <CondolenceFields params={calcParams} onChange={updateParams} />
      case '07':
        return <FarewellFields params={calcParams} onChange={updateParams} />
      case '08':
        return (
          <p className="text-sm text-gray-500">
            定年退職記念品には追加入力項目はありません。
          </p>
        )
      default:
        return null
    }
  }

  // -- Simulation --
  function handleSimulation() {
    setSimulationError('')
    setSimulationResult(null)

    if (!member) {
      setSimulationError('会員を選択してください')
      return
    }
    if (!benefitTypeCode) {
      setSimulationError('給付金種別を選択してください')
      return
    }

    try {
      const result = calculateBenefit(
        benefitTypeCode,
        { ...calcParams, memberId: member.member_id },
        member,
      )
      setSimulationResult(result)
    } catch (err) {
      setSimulationError(err instanceof Error ? err.message : 'シミュレーションに失敗しました')
    }
  }

  // -- File attachment --
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setFileError('')

    const MAX_SIZE = 5 * 1024 * 1024
    const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf']
    const validFiles: File[] = []

    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        setFileError(`「${file.name}」は5MBを超えています`)
        e.target.value = ''
        return
      }
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !ALLOWED_EXT.includes(ext)) {
        setFileError(`「${file.name}」は対応していない形式です（JPG, PNG, PDF のみ）`)
        e.target.value = ''
        return
      }
      validFiles.push(file)
    }

    setSelectedFiles(prev => [...prev, ...validFiles])
    e.target.value = ''
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  function isImage(name: string) {
    return /\.(jpg|jpeg|png)$/i.test(name)
  }

  // -- Submit --
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setResult(null)

    if (!member) {
      setSubmitError('会員を選択してください')
      return
    }
    if (!benefitTypeCode) {
      setSubmitError('給付金種別を選択してください')
      return
    }

    startTransition(async () => {
      try {
        const res = await createApplication({
          memberId: member.member_id,
          benefitTypeCode,
          calculationParams: { ...calcParams, memberId: member.member_id },
          applicationContent: { ...calcParams },
        })

        if (res.success) {
          // Upload attachments after application is created
          for (const file of selectedFiles) {
            const buffer = await file.arrayBuffer()
            await uploadAttachment(res.applicationId, file.name, buffer, file.type)
          }

          setResult({
            applicationId: res.applicationId,
            benefitResult: res.benefitResult,
          })
        } else {
          setSubmitError(res.error)
        }
      } catch {
        setSubmitError('申請の送信中にエラーが発生しました')
      }
    })
  }

  // -- If already submitted successfully, show result --
  if (result) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-gray-800">申請が完了しました</h3>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-gray-600 w-32">申請ID:</dt>
            <dd className="text-gray-800 font-mono">{result.applicationId}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-600 w-32">給付金種別:</dt>
            <dd className="text-gray-800">{result.benefitResult.benefitType}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-600 w-32">算定金額:</dt>
            <dd className="text-gray-800 font-bold text-lg">
              {formatCurrency(result.benefitResult.amount)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-600 w-32">算定根拠:</dt>
            <dd className="text-gray-700">{result.benefitResult.calculationDetails}</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push(selfMemberId ? '/mypage' : '/applications')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            {selfMemberId ? 'マイページへ' : '申請一覧へ'}
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null)
              setMember(null)
              setMemberIdInput('')
              setBenefitTypeCode('')
              setCalcParams({ memberId: '' })
              setSelectedFiles([])
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            続けて申請
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      {/* -- Section 1: Member -- */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-800 mb-4">
          {selfMemberId ? '申請者情報' : '会員検索'}
        </h3>

        {/* Search UI only for admin/approver (no selfMemberId) */}
        {!selfMemberId && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="会員ID（例: VT-00001）"
              value={memberIdInput}
              onChange={e => setMemberIdInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleMemberSearch()
                }
              }}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleMemberSearch}
              disabled={memberLoading || !memberIdInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {memberLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              検索
            </button>
          </div>
        )}

        {/* Loading state for self member */}
        {selfMemberId && memberLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            会員情報を読み込み中...
          </div>
        )}

        {memberError && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {memberError}
          </p>
        )}

        {member && (
          <div className={`${selfMemberId ? '' : 'mt-4 '}rounded-lg bg-blue-50 border border-blue-200 p-4`}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium text-gray-600">会員ID:</dt>
                <dd className="text-gray-800">{member.member_id}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-600">会社:</dt>
                <dd className="text-gray-800">{member.company_name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-600">氏名:</dt>
                <dd className="text-gray-800">{member.last_name} {member.first_name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-gray-600">在籍状況:</dt>
                <dd className="text-gray-800">{member.employment_status}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* -- Section 2: Benefit Type -- */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-800 mb-4">給付金種別</h3>
        <select
          value={benefitTypeCode}
          onChange={e => {
            setBenefitTypeCode(e.target.value)
            setSimulationResult(null)
            setSimulationError('')
            // Reset dynamic params when type changes, keep memberId
            setCalcParams({
              memberId: member?.member_id ?? '',
              standardMonthlyRemuneration: member?.standard_monthly_remuneration ?? undefined,
            })
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">選択してください</option>
          {BENEFIT_TYPE_LIST.map(b => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* -- Section 3: Dynamic Fields -- */}
      {benefitTypeCode && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4">詳細情報</h3>
          {renderDynamicFields()}
        </div>
      )}

      {/* -- Simulation -- */}
      {benefitTypeCode && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-800">シミュレーション</h3>
            <button
              type="button"
              onClick={handleSimulation}
              disabled={!benefitTypeCode}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Calculator className="w-4 h-4" />
              計算する
            </button>
          </div>

          {simulationError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{simulationError}</p>
            </div>
          )}

          {simulationResult && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">計算結果（プレビュー）</span>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="font-medium text-gray-600 w-32">給付金種別:</dt>
                  <dd className="text-gray-800">{simulationResult.benefitType}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-gray-600 w-32">算定金額:</dt>
                  <dd className="text-green-700 font-bold text-lg">{formatCurrency(simulationResult.amount)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="font-medium text-gray-600 w-32">算定根拠:</dt>
                  <dd className="text-gray-700">{simulationResult.calculationDetails}</dd>
                </div>
                {simulationResult.membershipYears != null && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600 w-32">入会年数:</dt>
                    <dd className="text-gray-700">{simulationResult.membershipYears}年</dd>
                  </div>
                )}
                {simulationResult.standardMonthlyRemuneration != null && (
                  <div className="flex gap-2">
                    <dt className="font-medium text-gray-600 w-32">標準報酬月額:</dt>
                    <dd className="text-gray-700">{formatCurrency(simulationResult.standardMonthlyRemuneration)}</dd>
                  </div>
                )}
              </dl>
              <p className="text-xs text-gray-400 mt-2">
                ※ この金額は概算です。実際の支給額は承認プロセスで確定されます。
              </p>
            </div>
          )}
        </div>
      )}

      {/* -- Section: Attachments -- */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          証明書・添付ファイル
        </h3>
        <p className="text-xs text-gray-500 mb-4">対応形式: JPG, PNG, PDF（各ファイル最大5MB）</p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 添付するボタン */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <Paperclip className="w-4 h-4" />
          添付する
        </button>

        {fileError && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {fileError}
          </p>
        )}

        {/* Attached files */}
        {selectedFiles.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              添付済み（{selectedFiles.length}件）
            </p>
            {selectedFiles.map((file, idx) => (
              <div
                key={`attached-${file.name}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3"
              >
                {isImage(file.name) ? (
                  <ImageIcon className="w-5 h-5 text-blue-500 shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="flex-1 text-sm text-gray-700 truncate">{file.name}</span>
                <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
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

      {/* -- Error message -- */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      {/* -- Submit button -- */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !member || !benefitTypeCode}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          申請する
        </button>
      </div>
    </form>
  )
}
