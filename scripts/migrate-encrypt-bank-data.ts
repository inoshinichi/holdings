/**
 * 既存の平文銀行データを暗号化する移行スクリプト
 *
 * 実行方法:
 *   npx tsx scripts/migrate-encrypt-bank-data.ts
 *
 * 必要な環境変数:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ENCRYPTION_KEY
 *
 * 注意:
 *   - コード変更のデプロイ後に実行すること
 *   - 冪等: 何度実行しても安全（ENC:v1: プレフィックスで暗号化済みデータをスキップ）
 *   - 本番実行前にバックアップを取得すること
 */

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// 暗号化関数（src/lib/encryption.ts と同じロジック）
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const PREFIX = 'ENC:v1:'

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return key
}

function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext

  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

const MEMBERS_BANK_FIELDS = [
  'bank_code', 'bank_name', 'branch_code', 'branch_name',
  'account_type', 'account_number', 'account_holder',
]

const PAYMENTS_BANK_FIELDS = [
  'bank_code', 'branch_code', 'account_type', 'account_number', 'account_holder',
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  // キーの検証
  getKey()

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- members テーブル ---
  console.log('Encrypting members bank data...')
  const { data: members, error: mErr } = await supabase
    .from('members')
    .select(['member_id', ...MEMBERS_BANK_FIELDS].join(', '))

  if (mErr) throw new Error(`Failed to fetch members: ${mErr.message}`)

  let memberCount = 0
  for (const member of (members ?? []) as Record<string, any>[]) {
    const updates: Record<string, string> = {}
    for (const field of MEMBERS_BANK_FIELDS) {
      const value = member[field]
      if (typeof value === 'string' && value && !isEncrypted(value)) {
        updates[field] = encrypt(value)
      }
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('members')
        .update(updates)
        .eq('member_id', member.member_id as string)
      if (error) {
        console.error(`  Failed to encrypt member ${member.member_id}:`, error.message)
      } else {
        memberCount++
      }
    }
  }
  console.log(`  Encrypted ${memberCount} / ${(members ?? []).length} member records`)

  // --- payments テーブル ---
  console.log('Encrypting payments bank data...')
  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select(['payment_id', ...PAYMENTS_BANK_FIELDS].join(', '))

  if (pErr) throw new Error(`Failed to fetch payments: ${pErr.message}`)

  let paymentCount = 0
  for (const payment of (payments ?? []) as Record<string, any>[]) {
    const updates: Record<string, string> = {}
    for (const field of PAYMENTS_BANK_FIELDS) {
      const value = payment[field]
      if (typeof value === 'string' && value && !isEncrypted(value)) {
        updates[field] = encrypt(value)
      }
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('payments')
        .update(updates)
        .eq('payment_id', payment.payment_id as string)
      if (error) {
        console.error(`  Failed to encrypt payment ${payment.payment_id}:`, error.message)
      } else {
        paymentCount++
      }
    }
  }
  console.log(`  Encrypted ${paymentCount} / ${(payments ?? []).length} payment records`)

  console.log('Migration complete.')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
