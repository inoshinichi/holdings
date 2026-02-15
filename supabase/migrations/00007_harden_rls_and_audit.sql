-- ============================================================
-- Phase 8: RLS hardening & audit log improvements
-- ============================================================

-- 1. audit_logs INSERT ポリシー強化
-- 現在: WITH CHECK(TRUE) → 誰でも任意のuser_emailでログを挿入可能
-- 修正: user_idがNULLまたは自分のIDと一致する場合のみ挿入可
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON audit_logs;

CREATE POLICY "Authenticated users can insert own logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid()::text);

-- 2. notifications INSERT ポリシー強化
-- 現在: WITH CHECK(TRUE) → 他ユーザー宛に通知を偽装可能
-- 修正: 自分宛の通知またはadminのみ挿入可
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

CREATE POLICY "Users can insert own notifications or admin can insert any"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) = 'admin'
  );

-- 3. audit_logs に ip_address カラムが存在しない場合は追加
-- (既存テーブルにカラムがない場合のみ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;
  END IF;
END $$;

-- 4. audit_logs に user_id カラムが存在しない場合は追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN user_id TEXT;
  END IF;
END $$;

-- 5. fee_settings テーブルにRLSが有効でない場合は有効化
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'fee_settings' AND rowsecurity = true
  ) THEN
    ALTER TABLE fee_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- fee_settings: 認証済みユーザーの読み取り許可（既存ポリシーがなければ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fee_settings' AND policyname = 'Authenticated users can read fee settings'
  ) THEN
    CREATE POLICY "Authenticated users can read fee settings"
      ON fee_settings FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;
END $$;

-- fee_settings: adminのみ管理可（既存ポリシーがなければ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fee_settings' AND policyname = 'Admins can manage fee settings'
  ) THEN
    CREATE POLICY "Admins can manage fee settings"
      ON fee_settings FOR ALL
      USING (get_user_role(auth.uid()) = 'admin');
  END IF;
END $$;
