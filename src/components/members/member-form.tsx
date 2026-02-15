'use client'

import { useState } from 'react'
import { registerMember } from '@/lib/actions/members'
import type { RegisterMemberInput } from '@/lib/actions/members'
import type { Company, FeeCategory } from '@/types/database'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface MemberFormProps {
  companies: Company[]
  lockedCompanyCode?: string
}

export function MemberForm({ companies, lockedCompanyCode }: MemberFormProps) {
  const [loading, setLoading] = useState(false)
  const [registeredId, setRegisteredId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Form fields
  const [memberId, setMemberId] = useState('')
  const [companyCode, setCompanyCode] = useState(lockedCompanyCode ?? '')
  const [companyName, setCompanyName] = useState(
    lockedCompanyCode ? (companies.find(c => c.company_code === lockedCompanyCode)?.company_name ?? '') : ''
  )
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastNameKana, setLastNameKana] = useState('')
  const [firstNameKana, setFirstNameKana] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [email, setEmail] = useState('')
  const [enrollmentDate, setEnrollmentDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [employmentType, setEmploymentType] = useState('')
  const [positionCategory, setPositionCategory] = useState('')
  const [feeCategory, setFeeCategory] = useState<FeeCategory | ''>('')
  const [standardMonthlyRemuneration, setStandardMonthlyRemuneration] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [bankName, setBankName] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [branchName, setBranchName] = useState('')
  const [accountType, setAccountType] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  function handleCompanyChange(code: string) {
    setCompanyCode(code)
    const found = companies.find((c) => c.company_code === code)
    setCompanyName(found?.company_name ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setRegisteredId(null)
    setLoading(true)

    if (!companyCode || !lastName || !firstName || !enrollmentDate || !feeCategory) {
      setError('必須項目を入力してください')
      setLoading(false)
      return
    }

    const input: RegisterMemberInput = {
      memberId: memberId || undefined,
      companyCode,
      companyName,
      lastName,
      firstName,
      lastNameKana: lastNameKana || undefined,
      firstNameKana: firstNameKana || undefined,
      birthDate: birthDate || undefined,
      gender: gender || undefined,
      email: email || undefined,
      enrollmentDate,
      employmentType: employmentType || undefined,
      positionCategory: positionCategory || undefined,
      feeCategory: feeCategory as FeeCategory,
      standardMonthlyRemuneration: standardMonthlyRemuneration
        ? Number(standardMonthlyRemuneration)
        : undefined,
      bankCode: bankCode || undefined,
      bankName: bankName || undefined,
      branchCode: branchCode || undefined,
      branchName: branchName || undefined,
      accountType: accountType || undefined,
      accountNumber: accountNumber || undefined,
      accountHolder: accountHolder || undefined,
    }

    try {
      const result = await registerMember(input)

      if (result.success) {
        setRegisteredId(result.memberId)
        toast.success(`会員を登録しました (ID: ${result.memberId})`)
      } else {
        setError(result.error)
        toast.error('登録に失敗しました')
      }
    } catch {
      setError('予期しないエラーが発生しました')
      toast.error('予期しないエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // Shared input class
  const inputCls =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
  const requiredMark = <span className="text-red-500 ml-0.5">*</span>

  // After successful registration, show success view
  if (registeredId) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-2">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-800">会員登録が完了しました</h3>
        <p className="text-gray-600">
          会員ID: <span className="font-mono font-bold text-blue-600">{registeredId}</span>
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link
            href="/members"
            className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition"
          >
            会員一覧へ
          </Link>
          <button
            onClick={() => {
              setRegisteredId(null)
              setMemberId('')
              setCompanyCode(lockedCompanyCode ?? '')
              setCompanyName(lockedCompanyCode ? (companies.find(c => c.company_code === lockedCompanyCode)?.company_name ?? '') : '')
              setLastName('')
              setFirstName('')
              setLastNameKana('')
              setFirstNameKana('')
              setBirthDate('')
              setGender('')
              setEmail('')
              setEnrollmentDate(new Date().toISOString().split('T')[0])
              setEmploymentType('')
              setPositionCategory('')
              setFeeCategory('')
              setStandardMonthlyRemuneration('')
              setBankCode('')
              setBankName('')
              setBranchCode('')
              setBranchName('')
              setAccountType('')
              setAccountNumber('')
              setAccountHolder('')
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition"
          >
            続けて登録する
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Basic information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">基本情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Company */}
          <div>
            <label className={labelCls}>
              会社{requiredMark}
            </label>
            <select
              value={companyCode}
              onChange={(e) => handleCompanyChange(e.target.value)}
              required
              disabled={!!lockedCompanyCode}
              className={`${inputCls} ${lockedCompanyCode ? 'bg-gray-100' : ''}`}
            >
              <option value="">選択してください</option>
              {companies.map((c) => (
                <option key={c.company_code} value={c.company_code}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Company name (auto-filled, readonly) */}
          <div>
            <label className={labelCls}>会社名</label>
            <input
              type="text"
              value={companyName}
              readOnly
              className={`${inputCls} bg-gray-50`}
              placeholder="会社を選択すると自動入力されます"
            />
          </div>

          {/* Member ID (optional) */}
          <div className="md:col-span-2">
            <label className={labelCls}>会員番号</label>
            <input
              type="text"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={inputCls}
              placeholder="空欄の場合は自動発番（例: VT-00001）"
            />
            <p className="mt-1 text-xs text-gray-500">
              任意の会員番号を指定できます。空欄の場合は会社コードに基づいて自動で発番されます。
            </p>
          </div>

          {/* Last name */}
          <div>
            <label className={labelCls}>
              姓{requiredMark}
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className={inputCls}
              placeholder="山田"
            />
          </div>

          {/* First name */}
          <div>
            <label className={labelCls}>
              名{requiredMark}
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className={inputCls}
              placeholder="太郎"
            />
          </div>

          {/* Last name kana */}
          <div>
            <label className={labelCls}>姓（カナ）</label>
            <input
              type="text"
              value={lastNameKana}
              onChange={(e) => setLastNameKana(e.target.value)}
              className={inputCls}
              placeholder="ヤマダ"
            />
          </div>

          {/* First name kana */}
          <div>
            <label className={labelCls}>名（カナ）</label>
            <input
              type="text"
              value={firstNameKana}
              onChange={(e) => setFirstNameKana(e.target.value)}
              className={inputCls}
              placeholder="タロウ"
            />
          </div>

          {/* Birth date */}
          <div>
            <label className={labelCls}>生年月日</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Gender */}
          <div>
            <label className={labelCls}>性別</label>
            <div className="flex items-center gap-4 pt-2">
              {['男', '女', 'その他'].map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={(e) => setGender(e.target.value)}
                    className="accent-blue-600"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="example@vt-holdings.co.jp"
            />
          </div>

          {/* Enrollment date */}
          <div>
            <label className={labelCls}>
              入会日{requiredMark}
            </label>
            <input
              type="date"
              value={enrollmentDate}
              onChange={(e) => setEnrollmentDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Employment & fee information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">雇用・会費情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Employment type */}
          <div>
            <label className={labelCls}>雇用形態</label>
            <input
              type="text"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className={inputCls}
              placeholder="正社員"
            />
          </div>

          {/* Position category */}
          <div>
            <label className={labelCls}>役職区分</label>
            <input
              type="text"
              value={positionCategory}
              onChange={(e) => setPositionCategory(e.target.value)}
              className={inputCls}
              placeholder="係長"
            />
          </div>

          {/* Fee category */}
          <div>
            <label className={labelCls}>
              会費区分{requiredMark}
            </label>
            <select
              value={feeCategory}
              onChange={(e) => setFeeCategory(e.target.value as FeeCategory | '')}
              required
              className={inputCls}
            >
              <option value="">選択してください</option>
              <option value="一般社員">一般社員</option>
              <option value="係長以上">係長以上</option>
              <option value="部長職以上">部長職以上</option>
            </select>
          </div>

          {/* Standard monthly remuneration */}
          <div>
            <label className={labelCls}>標準報酬月額</label>
            <input
              type="number"
              value={standardMonthlyRemuneration}
              onChange={(e) => setStandardMonthlyRemuneration(e.target.value)}
              className={inputCls}
              placeholder="300000"
              min={0}
            />
          </div>
        </div>
      </div>

      {/* Bank information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">口座情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bank code */}
          <div>
            <label className={labelCls}>銀行コード</label>
            <input
              type="text"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className={inputCls}
              placeholder="0001"
              maxLength={4}
            />
          </div>

          {/* Bank name */}
          <div>
            <label className={labelCls}>銀行名</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className={inputCls}
              placeholder="みずほ銀行"
            />
          </div>

          {/* Branch code */}
          <div>
            <label className={labelCls}>支店コード</label>
            <input
              type="text"
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              className={inputCls}
              placeholder="001"
              maxLength={3}
            />
          </div>

          {/* Branch name */}
          <div>
            <label className={labelCls}>支店名</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className={inputCls}
              placeholder="東京営業部"
            />
          </div>

          {/* Account type */}
          <div>
            <label className={labelCls}>口座種別</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className={inputCls}
            >
              <option value="">選択してください</option>
              <option value="普通">普通</option>
              <option value="当座">当座</option>
            </select>
          </div>

          {/* Account number */}
          <div>
            <label className={labelCls}>口座番号</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className={inputCls}
              placeholder="1234567"
              maxLength={7}
            />
          </div>

          {/* Account holder */}
          <div className="md:col-span-2">
            <label className={labelCls}>口座名義</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className={inputCls}
              placeholder="ヤマダ タロウ"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/members"
          className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition"
        >
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? '登録中...' : '登録'}
        </button>
      </div>
    </form>
  )
}
