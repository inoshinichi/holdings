import type { Payment } from '@/types/database'
import { ZENGIN_CONFIG } from './constants'
import { toZenginKana, padLeft, padRight, convertAccountType } from './kana-converter'
import { format } from 'date-fns'

export function generateZenginCSV(payments: Payment[], transferDate: Date): string {
  const lines: string[] = []

  lines.push(createHeaderRecord(transferDate))

  let totalAmount = 0
  payments.forEach((payment, index) => {
    lines.push(createDataRecord(payment, index + 1))
    totalAmount += payment.payment_amount || 0
  })

  lines.push(createTrailerRecord(payments.length, totalAmount))
  lines.push(createEndRecord())

  return lines.join('\r\n')
}

function createHeaderRecord(transferDate: Date): string {
  const parts: string[] = []

  parts.push('1')                                                              // データ区分
  parts.push('21')                                                             // 種別コード
  parts.push('0')                                                              // コード区分
  parts.push(padRight(ZENGIN_CONFIG.HEADER.CONSIGNOR_CODE, 10, '0'))          // 委託者コード
  parts.push(padRight(toZenginKana(ZENGIN_CONFIG.HEADER.CONSIGNOR_NAME), 40, ' ')) // 委託者名
  parts.push(format(transferDate, 'MMdd'))                                     // 振込指定日
  parts.push(padRight(ZENGIN_CONFIG.HEADER.BANK_CODE, 4, '0'))               // 銀行番号
  parts.push(padRight(toZenginKana(ZENGIN_CONFIG.HEADER.BANK_NAME), 15, ' ')) // 銀行名
  parts.push(padRight(ZENGIN_CONFIG.HEADER.BRANCH_CODE, 3, '0'))             // 支店番号
  parts.push(padRight(toZenginKana(ZENGIN_CONFIG.HEADER.BRANCH_NAME), 15, ' ')) // 支店名
  parts.push(ZENGIN_CONFIG.HEADER.ACCOUNT_TYPE)                               // 預金種目
  parts.push(padLeft(ZENGIN_CONFIG.HEADER.ACCOUNT_NUMBER, 7, '0'))            // 口座番号
  parts.push(padRight('', 17, ' '))                                            // ダミー

  return parts.join('')
}

function createDataRecord(payment: Payment, _seqNo: number): string {
  const parts: string[] = []

  parts.push('2')                                                               // データ区分
  parts.push(padLeft(payment.bank_code || '0000', 4, '0'))                     // 銀行番号
  parts.push(padRight(toZenginKana(''), 15, ' '))                              // 銀行名
  parts.push(padLeft(payment.branch_code || '000', 3, '0'))                    // 支店番号
  parts.push(padRight(toZenginKana(''), 15, ' '))                              // 支店名
  parts.push('0000')                                                            // 手形交換所番号
  parts.push(convertAccountType(payment.account_type))                          // 預金種目
  parts.push(padLeft(payment.account_number || '0000000', 7, '0'))             // 口座番号
  parts.push(padRight(toZenginKana(payment.account_holder || ''), 30, ' '))    // 受取人名
  parts.push(padLeft(String(payment.payment_amount || 0), 10, '0'))            // 振込金額
  parts.push('0')                                                               // 新規コード
  parts.push(padRight(payment.member_id || '', 10, ' '))                       // 顧客コード1
  parts.push(padRight(payment.application_id || '', 10, ' '))                  // 顧客コード2
  parts.push('7')                                                               // 振込指定区分
  parts.push(' ')                                                               // 識別表示
  parts.push(padRight('', 7, ' '))                                             // ダミー

  return parts.join('')
}

function createTrailerRecord(count: number, totalAmount: number): string {
  const parts: string[] = []

  parts.push('8')                                          // データ区分
  parts.push(padLeft(String(count), 6, '0'))              // 合計件数
  parts.push(padLeft(String(totalAmount), 12, '0'))       // 合計金額
  parts.push(padRight('', 101, ' '))                       // ダミー

  return parts.join('')
}

function createEndRecord(): string {
  const parts: string[] = []

  parts.push('9')                                          // データ区分
  parts.push(padRight('', 119, ' '))                       // ダミー

  return parts.join('')
}
