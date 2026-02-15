import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

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

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext

  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  if (!isEncrypted(ciphertext)) return ciphertext

  const key = getKey()
  const parts = ciphertext.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

const BANK_FIELDS_MEMBERS = [
  'bank_code', 'bank_name', 'branch_code', 'branch_name',
  'account_type', 'account_number', 'account_holder',
] as const

const BANK_FIELDS_PAYMENTS = [
  'bank_code', 'branch_code', 'account_type', 'account_number', 'account_holder',
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encryptBankFields<T>(record: T, table: 'members' | 'payments'): T {
  const fields = table === 'members' ? BANK_FIELDS_MEMBERS : BANK_FIELDS_PAYMENTS
  const result = { ...record } as any
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value && !isEncrypted(value)) {
      result[field] = encrypt(value)
    }
  }
  return result as T
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decryptBankFields<T>(record: T, table: 'members' | 'payments'): T {
  const fields = table === 'members' ? BANK_FIELDS_MEMBERS : BANK_FIELDS_PAYMENTS
  const result = { ...record } as any
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string' && value && isEncrypted(value)) {
      result[field] = decrypt(value)
    }
  }
  return result as T
}
