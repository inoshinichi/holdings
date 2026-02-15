export type UserRole = 'admin' | 'approver' | 'member'
export type EmploymentStatus = '在職中' | '休会中' | '退会'
export type FeeCategory = '一般社員' | '係長以上' | '部長職以上'
export type ApplicationStatus =
  | 'DRAFT' | 'PENDING' | 'COMPANY_APPROVED'
  | 'HQ_APPROVED' | 'PAID' | 'REJECTED' | 'CANCELLED'
export type FeeStatus = '未請求' | '請求済' | '一部入金' | '入金完了'
export type PermissionLevel = 'hq' | 'company'
export type Gender = '男' | '女' | 'その他'

export interface UserProfile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  company_code: string | null
  member_id: string | null
  approver_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  company_code: string
  company_name: string
  company_name_kana: string | null
  postal_code: string | null
  address: string | null
  phone: string | null
  contact_name: string | null
  contact_email: string | null
  approver_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Member {
  member_id: string
  company_code: string
  company_name: string
  last_name: string
  first_name: string
  last_name_kana: string | null
  first_name_kana: string | null
  birth_date: string | null
  gender: Gender | null
  email: string | null
  enrollment_date: string
  withdrawal_date: string | null
  leave_start_date: string | null
  leave_end_date: string | null
  employment_status: EmploymentStatus
  employment_type: string | null
  position_category: string | null
  fee_category: FeeCategory
  fee_amount: number
  standard_monthly_remuneration: number | null
  bank_code: string | null
  bank_name: string | null
  branch_code: string | null
  branch_name: string | null
  account_type: string | null
  account_number: string | null
  account_holder: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  application_id: string
  application_date: string
  member_id: string
  member_name: string
  company_code: string
  company_name: string
  benefit_type_code: string
  benefit_type_name: string
  application_content: Record<string, unknown> | null
  attachments: string | null
  calculation_base_date: string | null
  membership_years: number | null
  standard_monthly_remuneration: number | null
  calculated_amount: number
  final_amount: number
  status: ApplicationStatus
  company_approver: string | null
  company_approval_date: string | null
  company_comment: string | null
  hq_approver: string | null
  hq_approval_date: string | null
  hq_comment: string | null
  scheduled_payment_date: string | null
  payment_completed_date: string | null
  created_at: string
  updated_at: string
}

export interface BenefitType {
  benefit_type_code: string
  benefit_type_name: string
  description: string | null
  required_documents: string | null
  is_active: boolean
}

export interface MonthlyFee {
  id: string
  year_month: string
  company_code: string
  company_name: string
  member_count: number
  general_count: number
  chief_count: number
  manager_count: number
  leave_count: number
  total_fee: number
  invoice_date: string | null
  payment_date: string | null
  paid_amount: number | null
  status: FeeStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  payment_id: string
  application_id: string
  member_id: string
  member_name: string
  company_code: string
  benefit_type: string
  payment_amount: number
  payment_date: string
  bank_code: string | null
  branch_code: string | null
  account_type: string | null
  account_number: string | null
  account_holder: string | null
  zengin_export_date: string | null
  notes: string | null
  created_at: string
}

export interface Approver {
  approver_id: string
  full_name: string
  email: string
  company_code: string
  permission_level: PermissionLevel
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  timestamp: string
  user_email: string | null
  user_id: string | null
  operation_type: string
  target: string | null
  details: string | null
  ip_address: string | null
}

export type NotificationType = 'info' | 'approval' | 'rejected' | 'paid' | 'admin'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  link: string | null
  is_read: boolean
  created_at: string
}

export interface BenefitCalculationResult {
  benefitType: string
  amount: number
  membershipYears?: number
  standardMonthlyRemuneration?: number
  monthlyBenefit?: number
  maxPeriodMonths?: number
  absenceDays?: number
  damageLevel?: string
  isOwnHouse?: boolean
  isHeadOfHousehold?: boolean
  relationship?: string
  isChiefMourner?: boolean
  calculationDetails: string
}

export interface CalculationParams {
  memberId: string
  eventDate?: string | null
  isRemarriage?: boolean
  isForChild?: boolean
  childCount?: number
  isStillbirth?: boolean
  schoolType?: string
  standardMonthlyRemuneration?: number
  absenceDays?: number
  damageLevel?: string
  isOwnHouse?: boolean
  isHeadOfHousehold?: boolean
  relationship?: string
  isChiefMourner?: boolean
  withdrawalDate?: string
}
