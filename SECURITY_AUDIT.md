# セキュリティ監査レポート

**監査日:** 2026-02-15
**対象システム:** VTホールディングスグループ共済会管理システム
**スタック:** Next.js 16.1.6 + React 19 + Supabase + TypeScript
**デプロイ先:** Vercel

---

## 総合評価: 中レベル

| 項目 | 評価 |
|------|------|
| 上場企業基準（JSOX/FISC） | **未達** |
| 社内利用（プロトタイプ） | 可 |
| 社内利用（本番運用） | 要改善 |

---

## 検出事項サマリ

| 重大度 | 件数 | 概要 |
|--------|------|------|
| CRITICAL | 4 | サーバーアクション認可なし、ページアクセス制御なし、銀行情報平文保存、入力バリデーション不足 |
| HIGH | 10 | APIルート認可なし、レート制限なし、CSPなし、パスワードポリシー不足 等 |
| MEDIUM | 10 | 弱いパスワード要件、IPアドレス未記録、RLS INSERT過剰許可 等 |
| LOW | 5 | パスワードフィールドがtype="text"、依存関係スキャンなし 等 |

---

## 1. 認証・セッション管理

### 良い点
- ミドルウェアで `supabase.auth.getUser()` を使用（安全なサーバー側JWT検証）
- 保護レイアウトでユーザー再検証済み
- `@supabase/ssr` によるCookieベースのセッション管理
- セッションCookieのミドルウェア伝搬が適切

### 問題点

#### [CRITICAL] C-1: ライブ認証情報の管理
- **ファイル:** `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` がDropbox上に存在。`.gitignore` に含まれておりGitには入らないが、Dropbox共有時に漏洩リスクあり
- **対策:** 認証情報のローテーション、シークレット管理サービス（Vercel Environment Variables等）の利用

#### [HIGH] C-2: ログイン試行のレート制限なし
- **ファイル:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/mypage-login/page.tsx`
- ブルートフォース攻撃への対策なし（スロットリング、CAPTCHA、アカウントロックなし）
- Supabase組み込みのレート制限は比較的緩い
- **対策:** `@upstash/ratelimit` 等によるサーバーサイドレート制限導入

#### [MEDIUM] C-3: パスワードポリシーが弱い
- **ファイル:** `src/app/(protected)/users/page.tsx` (line 78)
- クライアント側で最低6文字のみ。サーバー側のパスワード複雑性検証なし
- JSOX/FISCガイドラインでは8文字以上＋複雑性要件が一般的
- **対策:** サーバーサイドで8文字以上、大文字・小文字・数字・記号を要求

#### [LOW] C-4: パスワード入力フィールドが平文表示
- **ファイル:** `src/app/(protected)/users/page.tsx` (lines 193, 258)
- `type="text"` → `type="password"` に変更が必要

---

## 2. 認可・アクセス制御

### 良い点
- 全11テーブルに包括的なRLSポリシー設定済み
- `get_user_role()`, `get_user_company_code()` ヘルパー関数が `SECURITY DEFINER` で適切に定義
- admin / approver / member の3段階ロールモデル
- 承認者は自社データにスコープ制限済み

### 問題点

#### [CRITICAL] A-1: ページレベルのアクセス制御が不足

以下のページに管理者ロールチェックがなく、会員ロールでもアクセス可能:

| ページ | リスク |
|--------|--------|
| `/master` | 全社データ、監査ログ、会費設定が閲覧可能 |
| `/users` | ユーザー管理ページが表示される（アクション自体は認可あり） |

**対策:** ページコンポーネントの先頭でロールチェックを追加し、権限不足時はリダイレクト

#### [CRITICAL] A-2: サーバーアクションにロールベース認可なし

RLSが安全弁として機能しているが、アプリケーション層の認可がない:

| ファイル | 関数 | リスク |
|----------|------|--------|
| `members.ts` | `registerMember()` | 誰でも会員登録可能 |
| `members.ts` | `updateMember()` | 誰でも会員情報更新可能 |
| `members.ts` | `setMemberOnLeave()` | 誰でも休会処理可能 |
| `members.ts` | `withdrawMember()` | 誰でも脱会処理可能 |
| `applications.ts` | `createApplication()` | 誰でも申請作成可能 |
| `approvals.ts` | `approveByCompany()` | ロールチェックなしで承認可能 |
| `approvals.ts` | `approveByHQ()` | ロールチェックなしで本部承認可能 |
| `approvals.ts` | `rejectApplication()` | 誰でも差戻し可能 |
| `approvals.ts` | `markAsPaid()` | 誰でも支払完了処理可能 |
| `fees.ts` | `generateMonthlyFees()` | 誰でも会費データ生成可能 |
| `fees.ts` | `recordFeePayment()` | 誰でも入金記録可能 |
| `fees.ts` | `markFeesAsInvoiced()` | 誰でも請求済み更新可能 |
| `master.ts` | `upsertCompany()` | 誰でも会社データ変更可能 |
| `master.ts` | `upsertApprover()` | 誰でも承認者設定変更可能 |
| `master.ts` | `updateFeeSetting()` | 誰でも会費単価変更可能 |
| `workflow.ts` | `assignCompanyApprover()` | 誰でも承認者割当可能 |
| `payments.ts` | `markPaymentsAsExported()` | 誰でもエクスポート済み更新可能 |

**対策:** 各サーバーアクションの先頭で `getUser()` + プロフィールのロール検証を追加

#### [HIGH] A-3: APIルートに認可チェックなし

| APIルート | 露出データ | リスク |
|-----------|-----------|--------|
| `/api/export-csv` | 全会員の銀行口座情報含むCSV | **最高リスク** |
| `/api/zengin-csv` | 全銀フォーマットの振込データ | 高リスク |
| `/api/invoice-pdf` | 請求書PDF | 中リスク |

**対策:** 各ルートの先頭で管理者ロールチェックを追加

---

## 3. 入力バリデーション

### 良い点
- `dangerouslySetInnerHTML`, `innerHTML`, `eval()` の使用なし
- ReactのJSXによるXSS防御が有効
- ファイルアップロードに拡張子・サイズ制限あり

### 問題点

#### [HIGH] V-1: Zodが未使用
- `package.json` に `zod` がインストール済みだが、サーバーアクションで一切使用されていない
- 全サーバーアクションの入力がランタイム検証なしでSupabaseクエリに渡される
- **対策:** 全サーバーアクションの入力にZodスキーマによるバリデーション追加

#### [HIGH] V-2: updateMember()が任意のフィールド更新を許可
- **ファイル:** `src/lib/actions/members.ts` line 209
- `data: Record<string, unknown>` — 完全にオープンな型。攻撃者が `fee_amount` 等の不正フィールドを渡す可能性あり
- **対策:** 更新可能フィールドをホワイトリスト化、Zodスキーマで制限

#### [MEDIUM] V-3: APIルートにCSRF対策なし
- Server Actionsは Next.js 組み込みのCSRF防御あり
- 3つのAPIルートにはCSRFトークンがない
- **対策:** カスタムCSRFトークン検証、またはServer Actionsへの移行

---

## 4. データ保護

### 良い点
- `.env*` が `.gitignore` に含まれている
- `SUPABASE_SERVICE_ROLE_KEY` が `NEXT_PUBLIC_` プレフィックスなし（ブラウザ非公開）
- `robots: noindex, nofollow, noarchive` 設定済み
- `X-Frame-Options: DENY`（クリックジャッキング防止）
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 問題点

#### [CRITICAL] D-1: 銀行口座データが平文保存
- **ファイル:** `supabase/migrations/00001_create_tables.sql` lines 56-62
- `bank_code`, `branch_code`, `account_number`, `account_holder` がTEXT型で暗号化なし
- FISCガイドラインでは金融データのアプリケーションレベル暗号化が必要
- **対策:** `pgcrypto` 拡張またはアプリケーションレベルでのAES暗号化

#### [HIGH] D-2: Content-Security-Policy (CSP) ヘッダーなし
- **ファイル:** `next.config.ts`
- XSS脆弱性が発見された場合の防御層がない
- **対策:** `next.config.ts` のheadersに適切なCSP追加

#### [HIGH] D-3: Strict-Transport-Security (HSTS) ヘッダーなし
- Vercelはデフォルトで追加するが、他の環境ではHTTPS強制がない
- **対策:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` 追加

#### [MEDIUM] D-4: 監査ログにIPアドレスが未記録
- `audit_logs` テーブルに `ip_address` カラムは存在するが、全てのinsertで省略されている
- **対策:** Server ActionsでリクエストヘッダーからIPアドレスを取得して記録

#### [MEDIUM] D-5: サービスロールキーのインライン使用
- **ファイル:** `src/lib/actions/applications.ts` lines 54-58
- `generateApplicationId()` で直接 `createClient()` を呼び出してサービスロールキーを使用
- **対策:** 集中管理された `createAdminClient()` を使用

---

## 5. APIセキュリティ

#### [HIGH] API-1: レート制限なし
- 全APIルートに無制限アクセス可能
- CSV/PDF生成の繰り返し呼び出しによるリソース枯渇リスク
- **対策:** `@upstash/ratelimit` またはVercel Edge Middleware でレート制限

#### [HIGH] API-2: CORS設定なし
- 明示的なCORS設定がない
- **対策:** `next.config.ts` で明示的にCORSを設定

#### [MEDIUM] API-3: エラーメッセージに内部情報漏洩の可能性
- `error.message` がそのままクライアントに返される箇所あり
- **対策:** ユーザー向けの汎用エラーメッセージに変換、詳細はサーバーログのみ

---

## 6. 監査ログ

### 良い点
- 広範囲の操作に監査ログが実装済み（会員登録/更新、申請作成/承認/差戻し、CSV出力、ユーザー管理、会費管理等）

### 問題点

#### [HIGH] AL-1: 監査ログ書き込み失敗が無視される
- 全ての監査ログinsertでエラーチェックなし。書き込み失敗しても操作は成功する
- 金融システムでは監査ログ失敗は致命的エラーとして扱うべき
- **対策:** 監査ログ失敗時はトランザクション全体をロールバック

#### [HIGH] AL-2: IPアドレス未記録
- JSOX準拠にはフォレンジック調査用のIPアドレスが必須
- **対策:** 全監査ログにIPアドレスを記録

#### [MEDIUM] AL-3: 一部の監査ログに user_id がない
- `members.ts` の一部でemailのみ記録、user_idなし
- **対策:** 全ログに `user_id` と `user_email` の両方を記録

#### [MEDIUM] AL-4: markFeesAsInvoiced() に監査ログなし
- **ファイル:** `src/lib/actions/fees.ts` lines 241-268
- 請求済み更新操作のログが欠落
- **対策:** 監査ログ追加

---

## 7. ファイルアップロード

### 良い点
- サーバーサイドで5MB制限
- 拡張子ホワイトリスト（jpg, jpeg, png, pdf）
- ファイル名のサニタイズ（非英数字を `_` に置換）
- タイムスタンププレフィックスで衝突防止
- ストレージバケットはPrivate設定

### 問題点

#### [MEDIUM] F-1: Content-Typeの実体検証なし
- クライアントから渡された `contentType` をそのまま使用。拡張子偽装が可能
- **対策:** サーバー側でマジックバイトによるファイルタイプ検証

#### [MEDIUM] F-2: 公開URLの使用
- **ファイル:** `src/lib/actions/attachments.ts` line 31
- `getPublicUrl()` を使用 → バケットがPrivateでも推測可能なURLが生成される
- **対策:** `createSignedUrl()` で時間制限付き署名付きURLを使用

#### [LOW] F-3: deleteAttachment() に所有者チェックなし
- 任意のユーザーが任意の添付ファイルを削除可能
- **対策:** 申請の所有者またはadminのみ削除可能に制限

---

## 8. RLSポリシー（Supabase）

### 良い点
- 全テーブルでRLS有効
- ロールベースポリシーが `SECURITY DEFINER` 関数で適切に評価
- 承認者の更新はPENDINGステータスのみに制限

### 問題点

#### [MEDIUM] RLS-1: 通知テーブルのINSERTが過剰許可
- `WITH CHECK (TRUE)` — 任意のユーザーが他ユーザー宛の通知を作成可能
- **対策:** `WITH CHECK (auth.uid() = user_id OR get_user_role() IN ('admin', 'approver'))`

#### [MEDIUM] RLS-2: 監査ログのINSERTが過剰許可
- `WITH CHECK (TRUE)` — 任意のユーザーが偽の監査ログを挿入可能
- **対策:** `user_id` カラムを `auth.uid()` に強制するWITH CHECK

#### [MEDIUM] RLS-3: ストレージRLSポリシーが未確認
- マイグレーションファイルにはコメントのみ。Supabaseダッシュボードでの設定状況が不明
- **対策:** ストレージポリシーのマイグレーション化

---

## 改善ロードマップ

### Phase 1: 即時対応（デプロイ前必須）

| # | 対策 | 対象ファイル | 工数目安 |
|---|------|-------------|---------|
| 1 | 全サーバーアクションにロールベース認可追加 | `src/lib/actions/*.ts` (7ファイル) | 1日 |
| 2 | 管理者専用ページにロールガード追加 | `master/page.tsx`, `users/page.tsx` | 0.5日 |
| 3 | APIルートに認可チェック追加 | `src/app/api/*/route.ts` (3ファイル) | 0.5日 |
| 4 | Zodによる入力バリデーション追加 | `src/lib/actions/*.ts` | 1日 |
| 5 | CSP・HSTSヘッダー追加 | `next.config.ts` | 0.5日 |
| 6 | パスワードフィールド修正 | `users/page.tsx` | 0.5時間 |

### Phase 2: 短期対応（1スプリント以内）

| # | 対策 | 工数目安 |
|---|------|---------|
| 7 | レート制限導入 | 1日 |
| 8 | パスワードポリシー強化（8文字以上、複雑性） | 0.5日 |
| 9 | 監査ログにIPアドレス記録 | 0.5日 |
| 10 | 監査ログ失敗時の処理改善 | 0.5日 |
| 11 | ストレージの署名付きURL対応 | 0.5日 |
| 12 | エラーメッセージの汎用化 | 0.5日 |

### Phase 3: 中期対応（外部監査前）

| # | 対策 | 工数目安 |
|---|------|---------|
| 13 | 銀行口座データの暗号化 | 2日 |
| 14 | RLS INSERTポリシーの強化 | 0.5日 |
| 15 | ファイルアップロードのContent-Type検証 | 0.5日 |
| 16 | CAPTCHA導入（ログインN回失敗後） | 1日 |
| 17 | 自動脆弱性スキャン設定（Dependabot） | 0.5日 |
| 18 | WAF導入（Cloudflare/Vercel） | 1日 |
| 19 | 第三者ペネトレーションテスト | 外部委託 |

---

## 参考規格

| 規格 | 現状対応 | 備考 |
|------|---------|------|
| JSOX（日本版SOX法） | 部分対応 | 監査ログはあるがIP未記録、認可不足 |
| FISC安全対策基準 | 未対応 | 銀行データ暗号化、多要素認証が必要 |
| 個人情報保護法 | 部分対応 | データアクセス制御あるが暗号化不足 |
| OWASP Top 10 | 部分対応 | Broken Access Control (A01) が主な課題 |

---

*このレポートは2026年2月15日時点のコードベースに基づいています。*
