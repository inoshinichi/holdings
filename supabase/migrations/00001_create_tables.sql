CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. user_profiles (links Supabase Auth to app roles)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'approver', 'member')),
  company_code TEXT,
  member_id TEXT,
  approver_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. companies
CREATE TABLE companies (
  company_code TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_name_kana TEXT,
  postal_code TEXT,
  address TEXT,
  phone TEXT,
  contact_name TEXT,
  contact_email TEXT,
  approver_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. members
CREATE TABLE members (
  member_id TEXT PRIMARY KEY,
  company_code TEXT NOT NULL REFERENCES companies(company_code),
  company_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name_kana TEXT,
  first_name_kana TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('男', '女', 'その他')),
  email TEXT,
  enrollment_date DATE NOT NULL,
  withdrawal_date DATE,
  leave_start_date DATE,
  leave_end_date DATE,
  employment_status TEXT NOT NULL DEFAULT '在職中' CHECK (employment_status IN ('在職中', '休会中', '退会')),
  employment_type TEXT DEFAULT '正社員',
  position_category TEXT,
  fee_category TEXT NOT NULL DEFAULT '一般社員' CHECK (fee_category IN ('一般社員', '係長以上', '部長職以上')),
  fee_amount INTEGER NOT NULL DEFAULT 500,
  standard_monthly_remuneration INTEGER,
  bank_code TEXT,
  bank_name TEXT,
  branch_code TEXT,
  branch_name TEXT,
  account_type TEXT DEFAULT '普通',
  account_number TEXT,
  account_holder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_company ON members(company_code);
CREATE INDEX idx_members_status ON members(employment_status);
CREATE INDEX idx_members_email ON members(email);

-- 4. benefit_types
CREATE TABLE benefit_types (
  benefit_type_code TEXT PRIMARY KEY,
  benefit_type_name TEXT NOT NULL,
  description TEXT,
  required_documents TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. applications
CREATE TABLE applications (
  application_id TEXT PRIMARY KEY,
  application_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id TEXT NOT NULL REFERENCES members(member_id),
  member_name TEXT NOT NULL,
  company_code TEXT NOT NULL REFERENCES companies(company_code),
  company_name TEXT NOT NULL,
  benefit_type_code TEXT NOT NULL REFERENCES benefit_types(benefit_type_code),
  benefit_type_name TEXT NOT NULL,
  application_content JSONB,
  attachments TEXT,
  calculation_base_date DATE,
  membership_years INTEGER,
  standard_monthly_remuneration INTEGER,
  calculated_amount INTEGER NOT NULL,
  final_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT', 'PENDING', 'COMPANY_APPROVED', 'HQ_APPROVED', 'PAID', 'REJECTED', 'CANCELLED')),
  company_approver TEXT,
  company_approval_date TIMESTAMPTZ,
  company_comment TEXT,
  hq_approver TEXT,
  hq_approval_date TIMESTAMPTZ,
  hq_comment TEXT,
  scheduled_payment_date DATE,
  payment_completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_applications_member ON applications(member_id);
CREATE INDEX idx_applications_company ON applications(company_code);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_date ON applications(application_date);

-- 6. monthly_fees
CREATE TABLE monthly_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year_month TEXT NOT NULL,
  company_code TEXT NOT NULL REFERENCES companies(company_code),
  company_name TEXT NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  general_count INTEGER NOT NULL DEFAULT 0,
  chief_count INTEGER NOT NULL DEFAULT 0,
  manager_count INTEGER NOT NULL DEFAULT 0,
  leave_count INTEGER NOT NULL DEFAULT 0,
  total_fee INTEGER NOT NULL DEFAULT 0,
  invoice_date DATE,
  payment_date DATE,
  paid_amount INTEGER,
  status TEXT NOT NULL DEFAULT '未請求' CHECK (status IN ('未請求', '請求済', '一部入金', '入金完了')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year_month, company_code)
);

CREATE INDEX idx_fees_year_month ON monthly_fees(year_month);
CREATE INDEX idx_fees_company ON monthly_fees(company_code);

-- 7. payments
CREATE TABLE payments (
  payment_id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(application_id),
  member_id TEXT NOT NULL REFERENCES members(member_id),
  member_name TEXT NOT NULL,
  company_code TEXT NOT NULL,
  benefit_type TEXT NOT NULL,
  payment_amount INTEGER NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bank_code TEXT,
  branch_code TEXT,
  account_type TEXT,
  account_number TEXT,
  account_holder TEXT,
  zengin_export_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_application ON payments(application_id);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_payments_zengin ON payments(zengin_export_date);

-- 8. approvers
CREATE TABLE approvers (
  approver_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  company_code TEXT NOT NULL REFERENCES companies(company_code),
  permission_level TEXT NOT NULL CHECK (permission_level IN ('hq', 'company')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvers_company ON approvers(company_code);
CREATE INDEX idx_approvers_email ON approvers(email);

-- 9. audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_email TEXT,
  user_id UUID,
  operation_type TEXT NOT NULL,
  target TEXT,
  details TEXT,
  ip_address TEXT
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_fees_updated_at BEFORE UPDATE ON monthly_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approvers_updated_at BEFORE UPDATE ON approvers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
