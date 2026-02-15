-- 会費設定テーブル
CREATE TABLE fee_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 自動updated_at
CREATE TRIGGER set_fee_settings_updated_at
  BEFORE UPDATE ON fee_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 初期データ
INSERT INTO fee_settings (category, amount) VALUES
  ('一般社員', 500),
  ('係長以上', 1000),
  ('部長職以上', 2000);

-- RLS
ALTER TABLE fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fee settings"
  ON fee_settings FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins can manage fee settings"
  ON fee_settings FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- Supabase Storage: attachments バケット
-- ※ Supabase ダッシュボードの Storage セクションで
--   「attachments」バケットを作成してください（Public: OFF）
-- 以下はStorageポリシーのガイドです（ダッシュボードで設定）:
--   - SELECT: 認証済みユーザー全員
--   - INSERT: 認証済みユーザー全員
--   - DELETE: admin のみ
-- ============================================================
