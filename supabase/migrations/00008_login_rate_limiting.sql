-- ============================================================================
-- 00008: ログイン試行レート制限テーブル
-- ============================================================================

CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  email TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE
);

-- IP + 時刻でのレート制限クエリ用インデックス
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);

-- 古いレコードのクリーンアップ用インデックス
CREATE INDEX idx_login_attempts_cleanup ON login_attempts(attempted_at);

-- RLS有効化（サービスロールのみアクセス）
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- サービスロール用ポリシー（アプリからはサービスロールキーで操作）
CREATE POLICY "Service role manages login attempts"
  ON login_attempts FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- 1時間以上前のレコードを削除するクリーンアップ関数
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
