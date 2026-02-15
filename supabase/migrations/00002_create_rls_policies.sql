ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE benefit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON user_profiles FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- companies
CREATE POLICY "Authenticated users can read companies" ON companies FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage companies" ON companies FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- members
CREATE POLICY "Admins can manage all members" ON members FOR ALL USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Approvers can view members in their company" ON members FOR SELECT USING (get_user_role(auth.uid()) = 'approver' AND company_code = get_user_company_code(auth.uid()));
CREATE POLICY "Members can view own record" ON members FOR SELECT USING (get_user_role(auth.uid()) = 'member' AND member_id = (SELECT member_id FROM user_profiles WHERE id = auth.uid()));

-- benefit_types
CREATE POLICY "Authenticated users can read benefit types" ON benefit_types FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage benefit types" ON benefit_types FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- applications
CREATE POLICY "Admins can manage all applications" ON applications FOR ALL USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Approvers can view applications for their company" ON applications FOR SELECT USING (get_user_role(auth.uid()) = 'approver' AND company_code = get_user_company_code(auth.uid()));
CREATE POLICY "Approvers can update applications for their company" ON applications FOR UPDATE USING (get_user_role(auth.uid()) = 'approver' AND company_code = get_user_company_code(auth.uid()) AND status = 'PENDING');
CREATE POLICY "Members can view own applications" ON applications FOR SELECT USING (get_user_role(auth.uid()) = 'member' AND member_id = (SELECT member_id FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Members can create applications" ON applications FOR INSERT TO authenticated WITH CHECK (member_id = (SELECT member_id FROM user_profiles WHERE id = auth.uid()) OR get_user_role(auth.uid()) IN ('admin', 'approver'));

-- monthly_fees
CREATE POLICY "Admins can manage all fees" ON monthly_fees FOR ALL USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Approvers can view fees for their company" ON monthly_fees FOR SELECT USING (get_user_role(auth.uid()) = 'approver' AND company_code = get_user_company_code(auth.uid()));

-- payments
CREATE POLICY "Admins can manage all payments" ON payments FOR ALL USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Approvers can view payments for their company" ON payments FOR SELECT USING (get_user_role(auth.uid()) = 'approver' AND company_code = get_user_company_code(auth.uid()));
CREATE POLICY "Members can view own payments" ON payments FOR SELECT USING (get_user_role(auth.uid()) = 'member' AND member_id = (SELECT member_id FROM user_profiles WHERE id = auth.uid()));

-- approvers
CREATE POLICY "Authenticated users can read approvers" ON approvers FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage approvers" ON approvers FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- audit_logs
CREATE POLICY "Admins can view all logs" ON audit_logs FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Authenticated users can insert logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
