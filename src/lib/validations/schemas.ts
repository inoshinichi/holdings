import { z } from 'zod'

// ============================================================
// Shared primitives
// ============================================================

export const companyCodeSchema = z.string().min(1).max(10)
export const memberIdSchema = z.string().min(1).max(20)
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です')
export const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, '年月形式が不正です')
export const emailSchema = z.string().email('メールアドレスの形式が不正です').max(255)

// ============================================================
// Member schemas
// ============================================================

export const registerMemberSchema = z.object({
  memberId: z.string().max(20).optional(),
  companyCode: companyCodeSchema,
  companyName: z.string().min(1).max(100),
  lastName: z.string().min(1, '姓は必須です').max(50),
  firstName: z.string().min(1, '名は必須です').max(50),
  lastNameKana: z.string().max(50).optional(),
  firstNameKana: z.string().max(50).optional(),
  birthDate: dateSchema.optional(),
  gender: z.enum(['男', '女', 'その他']).optional(),
  email: emailSchema.optional(),
  enrollmentDate: dateSchema,
  employmentType: z.string().max(50).optional(),
  positionCategory: z.string().max(50).optional(),
  feeCategory: z.enum(['一般社員', '係長以上', '部長職以上']),
  standardMonthlyRemuneration: z.number().int().min(0).max(10_000_000).optional(),
  bankCode: z.string().max(4).optional(),
  bankName: z.string().max(50).optional(),
  branchCode: z.string().max(3).optional(),
  branchName: z.string().max(50).optional(),
  accountType: z.string().max(10).optional(),
  accountNumber: z.string().max(7).optional(),
  accountHolder: z.string().max(50).optional(),
})

export const updateMemberSchema = z.object({
  last_name: z.string().min(1).max(50).optional(),
  first_name: z.string().min(1).max(50).optional(),
  last_name_kana: z.string().max(50).nullable().optional(),
  first_name_kana: z.string().max(50).nullable().optional(),
  birth_date: z.string().nullable().optional(),
  gender: z.enum(['男', '女', 'その他']).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  employment_type: z.string().max(50).nullable().optional(),
  position_category: z.string().max(50).nullable().optional(),
  fee_category: z.enum(['一般社員', '係長以上', '部長職以上']).optional(),
  fee_amount: z.number().int().min(0).optional(),
  standard_monthly_remuneration: z.number().int().min(0).nullable().optional(),
  bank_code: z.string().max(4).nullable().optional(),
  bank_name: z.string().max(50).nullable().optional(),
  branch_code: z.string().max(3).nullable().optional(),
  branch_name: z.string().max(50).nullable().optional(),
  account_type: z.string().max(10).nullable().optional(),
  account_number: z.string().max(7).nullable().optional(),
  account_holder: z.string().max(50).nullable().optional(),
}).strict()

// ============================================================
// Application schemas
// ============================================================

export const createApplicationSchema = z.object({
  memberId: memberIdSchema,
  benefitTypeCode: z.string().min(1).max(10),
  calculationParams: z.record(z.string(), z.unknown()),
  applicationContent: z.record(z.string(), z.unknown()).optional(),
})

// ============================================================
// Company schemas
// ============================================================

export const upsertCompanySchema = z.object({
  company_code: companyCodeSchema,
  company_name: z.string().min(1).max(100).optional(),
  company_name_kana: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(8).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  contact_name: z.string().max(50).nullable().optional(),
  contact_email: z.string().email().max(255).nullable().optional(),
  approver_id: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
}).strict()

// ============================================================
// Fee schemas
// ============================================================

export const recordFeePaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().int().min(1, '入金額は1以上にしてください').max(100_000_000),
  paymentDate: dateSchema.optional(),
})

export const feeIdsSchema = z.array(z.string().uuid()).min(1).max(1000)

// ============================================================
// User / Password schemas
// ============================================================

export const passwordSchema = z.string()
  .min(8, 'パスワードは8文字以上にしてください')
  .regex(/[A-Z]/, '大文字を含めてください')
  .regex(/[a-z]/, '小文字を含めてください')
  .regex(/[0-9]/, '数字を含めてください')

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().max(100).optional(),
  role: z.enum(['admin', 'approver', 'member']),
  companyCode: companyCodeSchema.optional(),
  memberId: memberIdSchema.optional(),
})

// ============================================================
// Notification schemas
// ============================================================

export const adminNotificationSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200).transform(s => s.trim()),
  message: z.string().min(1, 'メッセージは必須です').max(2000).transform(s => s.trim()),
  target: z.enum(['all', 'company', 'member']),
  companyCode: companyCodeSchema.optional(),
  memberId: memberIdSchema.optional(),
})
