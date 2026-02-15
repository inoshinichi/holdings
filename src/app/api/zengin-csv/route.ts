import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateZenginCSV } from '@/lib/zengin/generator'
import type { Payment } from '@/types/database'
import { decryptBankFields } from '@/lib/encryption'

export async function POST(request: NextRequest) {
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

    // Admin role check
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'この操作には管理者権限が必要です' },
        { status: 403 },
      )
    }

    // Parse request body
    const body = await request.json()
    const { paymentIds } = body as { paymentIds?: string[] }

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json(
        { error: '支払いIDが指定されていません' },
        { status: 400 },
      )
    }

    // Fetch payment records
    const { data: payments, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .in('payment_id', paymentIds)

    if (fetchError) {
      console.error('支払いデータの取得に失敗しました:', fetchError.message)
      return NextResponse.json(
        { error: '支払いデータの取得に失敗しました' },
        { status: 500 },
      )
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { error: '指定された支払いデータが見つかりません' },
        { status: 404 },
      )
    }

    const typedPayments = (payments as Payment[]).map(p => decryptBankFields(p, 'payments'))

    // Generate Zengin CSV
    const transferDate = new Date()
    const csvContent = generateZenginCSV(typedPayments, transferDate)

    // Mark payments as exported
    const { error: updateError } = await supabase
      .from('payments')
      .update({ zengin_export_date: new Date().toISOString() })
      .in('payment_id', paymentIds)

    if (updateError) {
      console.error('全銀CSV出力日の更新に失敗しました:', updateError.message)
      // Continue to return the CSV even if marking fails
    }

    // Write audit log
    await supabase.from('audit_logs').insert({
      user_email: user.email,
      operation_type: '全銀CSV出力',
      target: `payments: ${paymentIds.length}件`,
      details: `対象payment_id: ${paymentIds.join(', ')}`,
    })

    // Generate filename with date
    const now = new Date()
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('')
    const filename = `zengin_${dateStr}.txt`

    // Return the file as a download
    // Zengin format uses Shift_JIS encoding, but the generator outputs ASCII-compatible content
    // so we return as text/plain with the proper Content-Disposition header
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=shift_jis',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('全銀CSV生成中にエラーが発生しました:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 },
    )
  }
}
