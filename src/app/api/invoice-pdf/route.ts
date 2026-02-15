import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { jsPDF } from 'jspdf'

export async function GET(request: NextRequest) {
  const feeId = request.nextUrl.searchParams.get('feeId')
  if (!feeId) {
    return NextResponse.json({ error: 'feeId is required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // 認証チェック
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  // Admin role check
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'この操作には管理者権限が必要です' }, { status: 403 })
  }

  // 会費データ取得
  const { data: fee, error } = await supabase
    .from('monthly_fees')
    .select('*')
    .eq('id', feeId)
    .single()

  if (error || !fee) {
    return NextResponse.json({ error: 'Fee record not found' }, { status: 404 })
  }

  // 会費設定取得
  const { data: feeSettings } = await supabase
    .from('fee_settings')
    .select('category, amount')
  const feeMap: Record<string, number> = {}
  for (const fs of feeSettings ?? []) {
    feeMap[fs.category as string] = fs.amount as number
  }
  const generalRate = feeMap['一般社員'] ?? 500
  const chiefRate = feeMap['係長以上'] ?? 1000
  const managerRate = feeMap['部長職以上'] ?? 2000

  // PDF生成
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // フォント設定（日本語はデフォルトフォントでは対応不可のためASCII+数字で対応）
  // 実運用ではカスタムフォントを埋め込む必要あり
  const pageWidth = 210
  const margin = 20
  let y = 30

  // タイトル
  doc.setFontSize(20)
  doc.text('INVOICE', pageWidth / 2, y, { align: 'center' })
  y += 12

  doc.setFontSize(12)
  doc.text('VT Holdings Group Kyosaikai', pageWidth / 2, y, { align: 'center' })
  y += 20

  // 請求情報
  doc.setFontSize(10)
  const yearMonth = fee.year_month as string
  const year = yearMonth.slice(0, 4)
  const month = yearMonth.slice(5, 7)

  doc.text(`Date: ${new Date().toISOString().slice(0, 10)}`, pageWidth - margin, y, { align: 'right' })
  doc.text(`Invoice No: INV-${yearMonth.replace('-', '')}-${(fee.company_code as string)}`, margin, y)
  y += 8

  doc.text(`Period: ${year}/${month}`, margin, y)
  y += 15

  // 宛先
  doc.setFontSize(12)
  doc.text(`To: ${fee.company_name as string}`, margin, y)
  y += 12

  // 区切り線
  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // 明細テーブルヘッダー
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Category', margin, y)
  doc.text('Members', 90, y, { align: 'right' })
  doc.text('Unit Price', 130, y, { align: 'right' })
  doc.text('Amount', pageWidth - margin, y, { align: 'right' })
  y += 3
  doc.line(margin, y, pageWidth - margin, y)
  y += 7

  // 明細行
  doc.setFont('helvetica', 'normal')

  const lines = [
    { label: 'General Staff', count: fee.general_count as number, rate: generalRate },
    { label: 'Section Chief+', count: fee.chief_count as number, rate: chiefRate },
    { label: 'Director+', count: fee.manager_count as number, rate: managerRate },
  ]

  for (const line of lines) {
    if (line.count > 0) {
      doc.text(line.label, margin, y)
      doc.text(String(line.count), 90, y, { align: 'right' })
      doc.text(`JPY ${line.rate.toLocaleString()}`, 130, y, { align: 'right' })
      doc.text(`JPY ${(line.count * line.rate).toLocaleString()}`, pageWidth - margin, y, { align: 'right' })
      y += 7
    }
  }

  if ((fee.leave_count as number) > 0) {
    doc.text(`On Leave: ${fee.leave_count} members (no charge)`, margin, y)
    y += 7
  }

  // 区切り線
  y += 3
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // 合計
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total:', 100, y, { align: 'right' })
  doc.text(`JPY ${(fee.total_fee as number).toLocaleString()}`, pageWidth - margin, y, { align: 'right' })
  y += 15

  // 摘要
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Members: ${fee.member_count as number}`, margin, y)
  y += 5
  doc.text(`Status: ${fee.status as string}`, margin, y)

  // PDFをバイナリに変換
  const pdfBytes = doc.output('arraybuffer')

  // 監査ログ
  await supabase.from('audit_logs').insert({
    user_email: user.email,
    operation_type: '請求書PDF発行',
    target: `${fee.company_name}`,
    details: `${yearMonth} 請求額: ${(fee.total_fee as number).toLocaleString()}円`,
  })

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${yearMonth.replace('-', '')}_${fee.company_code}.pdf"`,
    },
  })
}
