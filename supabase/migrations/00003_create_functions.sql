-- Generate member ID: CompanyCode-00001
CREATE OR REPLACE FUNCTION generate_member_id(p_company_code TEXT)
RETURNS TEXT AS $$
DECLARE
  max_num INTEGER;
  new_id TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(member_id, '-', 2) AS INTEGER)), 0) + 1
  INTO max_num
  FROM members
  WHERE member_id LIKE p_company_code || '-%';
  new_id := p_company_code || '-' || LPAD(max_num::TEXT, 5, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate application ID: APyyyyMMdd####
CREATE OR REPLACE FUNCTION generate_application_id()
RETURNS TEXT AS $$
DECLARE
  date_str TEXT;
  max_seq INTEGER;
  new_id TEXT;
BEGIN
  date_str := TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(RIGHT(application_id, 4) AS INTEGER)), 0) + 1
  INTO max_seq
  FROM applications
  WHERE application_id LIKE 'AP' || date_str || '%';
  new_id := 'AP' || date_str || LPAD(max_seq::TEXT, 4, '0');
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Generate payment ID: PAYyyyyMMddHHmmss
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'PAY' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Tokyo', 'YYYYMMDDHH24MISS');
END;
$$ LANGUAGE plpgsql;

-- Helper: get user role from profile
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM user_profiles WHERE id = p_user_id;
  RETURN COALESCE(v_role, 'member');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: get user's company code
CREATE OR REPLACE FUNCTION get_user_company_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_company_code TEXT;
BEGIN
  SELECT company_code INTO v_company_code FROM user_profiles WHERE id = p_user_id;
  RETURN v_company_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT := 'member';
  v_company_code TEXT;
  v_approver_id TEXT;
  v_member_id TEXT;
  v_perm TEXT;
BEGIN
  SELECT approver_id, company_code, permission_level
  INTO v_approver_id, v_company_code, v_perm
  FROM approvers
  WHERE email = NEW.email AND is_active = TRUE
  LIMIT 1;

  IF v_approver_id IS NOT NULL THEN
    IF v_perm = 'hq' THEN
      v_role := 'admin';
    ELSE
      v_role := 'approver';
    END IF;
  ELSE
    SELECT member_id, company_code
    INTO v_member_id, v_company_code
    FROM members
    WHERE email = NEW.email AND employment_status != '退会'
    LIMIT 1;
    v_role := 'member';
  END IF;

  INSERT INTO user_profiles (id, email, display_name, role, company_code, member_id, approver_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    v_role,
    v_company_code,
    v_member_id,
    v_approver_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
