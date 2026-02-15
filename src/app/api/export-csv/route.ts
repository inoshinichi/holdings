import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getMembers } from '@/lib/actions/members'
import { getApplications } from '@/lib/actions/applications'
import { getPayments } from '@/lib/actions/payments'
import { getFees } from '@/lib/actions/fees'
import Encoding from 'encoding-japanese'

// ---------------------------------------------------------------------------
// Supported export types
// ---------------------------------------------------------------------------

type ExportType = 'members' | 'applications' | 'payments' | 'fees'

const VALID_TYPES: ExportType[] = ['members', 'applications', 'payments', 'fees']

// ---------------------------------------------------------------------------
// CSV generation helpers
// ---------------------------------------------------------------------------

function escapeCSVField(value: unknown): string {
  if (value == null) return ''
  const str = String(value)
  // If the field contains a comma, double-quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSVField).join(',')
  const dataLines = rows.map(row => row.map(escapeCSVField).join(','))
  return [headerLine, ...dataLines].join('\r\n')
}

function toShiftJISBuffer(utf8String: string): Uint8Array {
  const unicodeArray = Encoding.stringToCode(utf8String)
  const sjisArray = Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE',
  })
  return new Uint8Array(sjisArray)
}

// ---------------------------------------------------------------------------
// Data formatters per type
// ---------------------------------------------------------------------------

async function generateMembersCSV(): Promise<string> {
  const members = await getMembers()
  const headers = [
    '会員ID', '会社コード', '会社名', '姓', '名',
    '姓カナ', '名カナ', '生年月日', '性別', 'メール',
    '入会日', '退会日', '在職状況', '雇用形態', '役職区分',
    '会費区分', '会費金額', '標準報酬月額',
    '銀行コード', '銀行名', '支店コード', '支店名',
    '口座種別', '口座番号', '口座名義',
  ]
  const rows = members.map(m => [
    m.member_id,
    m.company_code,
    m.company_name,
    m.last_name,
    m.first_name,
    m.last_name_kana ?? '',
    m.first_name_kana ?? '',
    m.birth_date ?? '',
    m.gender ?? '',
    m.email ?? '',
    m.enrollment_date,
    m.withdrawal_date ?? '',
    m.employment_status,
    m.employment_type ?? '',
    m.position_category ?? '',
    m.fee_category,
    String(m.fee_amount),
    m.standard_monthly_remuneration != null ? String(m.standard_monthly_remuneration) : '',
    m.bank_code ?? '',
    m.bank_name ?? '',
    m.branch_code ?? '',
    m.branch_name ?? '',
    m.account_type ?? '',
    m.account_number ?? '',
    m.account_holder ?? '',
  ])
  return toCSV(headers, rows)
}

async function generateApplicationsCSV(): Promise<string> {
  const applications = await getApplications()
  const headers = [
    '申請ID', '申請日', '会員ID', '会員名', '会社コード', '会社名',
    '給付金コード', '給付金種別', '計算基準日', '在籍年数',
    '標準報酬月額', '計算金額', '確定金額', 'ステータス',
    '各社承認者', '各社承認日', '各社コメント',
    '本部承認者', '本部承認日', '本部コメント',
    '支払予定日', '支払完了日',
  ]
  const rows = applications.map(a => [
    a.application_id,
    a.application_date,
    a.member_id,
    a.member_name,
    a.company_code,
    a.company_name,
    a.benefit_type_code,
    a.benefit_type_name,
    a.calculation_base_date ?? '',
    a.membership_years != null ? String(a.membership_years) : '',
    a.standard_monthly_remuneration != null ? String(a.standard_monthly_remuneration) : '',
    String(a.calculated_amount),
    String(a.final_amount),
    a.status,
    a.company_approver ?? '',
    a.company_approval_date ?? '',
    a.company_comment ?? '',
    a.hq_approver ?? '',
    a.hq_approval_date ?? '',
    a.hq_comment ?? '',
    a.scheduled_payment_date ?? '',
    a.payment_completed_date ?? '',
  ])
  return toCSV(headers, rows)
}

async function generatePaymentsCSV(): Promise<string> {
  const payments = await getPayments()
  const headers = [
    '支払ID', '申請ID', '会員ID', '会員名', '会社コード',
    '給付金種別', '支払金額', '支払日',
    '銀行コード', '支店コード', '口座種別', '口座番号', '口座名義',
    '全銀出力日', '備考',
  ]
  const rows = payments.map(p => [
    p.payment_id,
    p.application_id,
    p.member_id,
    p.member_name,
    p.company_code,
    p.benefit_type,
    String(p.payment_amount),
    p.payment_date,
    p.bank_code ?? '',
    p.branch_code ?? '',
    p.account_type ?? '',
    p.account_number ?? '',
    p.account_holder ?? '',
    p.zengin_export_date ?? '',
    p.notes ?? '',
  ])
  return toCSV(headers, rows)
}

async function generateFeesCSV(): Promise<string> {
  const fees = await getFees()
  const headers = [
    'ID', '年月', '会社コード', '会社名',
    '会員数', '一般社員数', '係長以上数', '部長職以上数', '休会者数',
    '合計会費', '請求日', '入金日', '入金額', 'ステータス', '備考',
  ]
  const rows = fees.map(f => [
    f.id,
    f.year_month,
    f.company_code,
    f.company_name,
    String(f.member_count),
    String(f.general_count),
    String(f.chief_count),
    String(f.manager_count),
    String(f.leave_count),
    String(f.total_fee),
    f.invoice_date ?? '',
    f.payment_date ?? '',
    f.paid_amount != null ? String(f.paid_amount) : '',
    f.status,
    f.notes ?? '',
  ])
  return toCSV(headers, rows)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 },
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ExportType | null

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `typeパラメータが不正です。有効な値: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      )
    }

    // Generate CSV based on type
    let csvContent: string

    switch (type) {
      case 'members':
        csvContent = await generateMembersCSV()
        break
      case 'applications':
        csvContent = await generateApplicationsCSV()
        break
      case 'payments':
        csvContent = await generatePaymentsCSV()
        break
      case 'fees':
        csvContent = await generateFeesCSV()
        break
    }

    // Convert to Shift_JIS for Japanese Excel compatibility
    const sjisBuffer = toShiftJISBuffer(csvContent)

    // Generate filename
    const now = new Date()
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('')

    const TYPE_LABELS: Record<ExportType, string> = {
      members: '会員一覧',
      applications: '申請一覧',
      payments: '支払一覧',
      fees: '会費一覧',
    }
    const filename = `${TYPE_LABELS[type]}_${dateStr}.csv`

    // Write audit log
    await supabase.from('audit_logs').insert({
      user_email: user.email,
      operation_type: 'CSVエクスポート',
      target: type,
      details: `${TYPE_LABELS[type]}のCSVエクスポート`,
    })

    // Return the Shift_JIS encoded CSV
    // Convert Uint8Array to Buffer for NextResponse compatibility
    const buffer = Buffer.from(sjisBuffer)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=shift_jis',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (err) {
    console.error('CSVエクスポート中にエラーが発生しました:', err)
    return NextResponse.json(
      { error: 'CSVエクスポート中にエラーが発生しました' },
      { status: 500 },
    )
  }
}
