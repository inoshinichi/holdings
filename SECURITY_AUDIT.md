# セキュリティ監査レポート & 開発ガイド

**初回監査日:** 2026-02-15
**最終更新:** 2026-02-15（TODO-2 レート制限 + TODO-6 銀行データ暗号化 実施後）
**対象システム:** VTホールディングスグループ共済会管理システム
**スタック:** Next.js 16.1.6 + React 19 + Supabase + TypeScript
**デプロイ先:** Vercel

---

## 総合評価

| 項目 | 監査時（実施前） | 実施後 |
|------|-----------------|--------|
| 上場企業基準（JSOX/FISC） | **未達** | **概ね対応**（残課題あり） |
| 社内利用（本番運用） | 要改善 | **可** |
| OWASP Top 10 対応 | 部分対応 | **大幅改善** |

---

## 実施済みセキュリティ強化（コミット `e88bb9e`）

### Phase 1: 認証基盤 [完了]
- `src/lib/actions/auth.ts` — `requireAuth()`, `requireRole()`, `getClientIP()` 追加
- `src/lib/errors.ts` — `AuthorizationError` クラス（`'use server'` 制約のため別ファイル）
- 全サーバーアクションで supabase client を認証ヘルパーから取得（二重インスタンス化防止）

### Phase 2: サーバーアクション認可 [完了]
- **12ファイル・45関数**全てにロールベース認可チェック追加
- approver は自社 `company_code` にスコープ強制
- member は自分の `member_id` にスコープ強制

| ファイル | 関数数 | 認可方式 |
|----------|--------|---------|
| `members.ts` | 7 | admin/approver（approver=自社） |
| `applications.ts` | 4 | admin/approver/member（各スコープ制限） |
| `approvals.ts` | 5 | admin/approver（approver=自社申請のみ） |
| `fees.ts` | 5 | admin（一部admin/approver読み取り） |
| `payments.ts` | 4 | admin のみ |
| `master.ts` | 9 | admin（getBenefitTypes のみ全ロール） |
| `workflow.ts` | 2 | admin のみ |
| `reports.ts` | 3 | admin/approver（approver=自社スコープ） |
| `users.ts` | 4 | admin のみ |
| `notifications.ts` | 6 | requireAuth + userId一致検証 |
| `attachments.ts` | 3 | requireAuth + 申請所有権検証 |

### Phase 3: ミドルウェア・ルート保護 [完了]
- `middleware.ts` にロールベースルーティング追加
- admin専用: `/master`, `/users`, `/payments`, `/workflow`
- admin+approver: `/members`, `/approvals`, `/fees`, `/statistics`
- 権限不足: member → `/mypage`, approver → `/dashboard` にリダイレクト

### Phase 4: Zod入力バリデーション [完了（スキーマ定義のみ）]
- `src/lib/validations/schemas.ts` 新規作成
- 定義済みスキーマ: `registerMemberSchema`, `updateMemberSchema`(.strict()), `createApplicationSchema`, `upsertCompanySchema`(.strict()), `recordFeePaymentSchema`, `passwordSchema`, `createUserSchema`, `adminNotificationSchema`
- **注意:** スキーマは定義済みだがサーバーアクションへの組み込みは未実施（次の開発で対応）

### Phase 5: APIルートセキュリティ [完了]
- `src/app/api/export-csv/route.ts` — admin ロールチェック + エラーメッセージサニタイズ
- `src/app/api/zengin-csv/route.ts` — admin ロールチェック + エラーメッセージサニタイズ
- `src/app/api/invoice-pdf/route.ts` — admin ロールチェック

### Phase 6: セキュリティヘッダー・パスワード [完了]
- `next.config.ts` — HSTS, CSP, Permissions-Policy 追加
- `src/app/(protected)/users/page.tsx` — `type="password"`, 8文字以上, 大文字・小文字・数字必須

### Phase 7: 添付ファイルセキュリティ [完了]
- `src/lib/actions/attachments.ts` — 全面書き直し
  - `getPublicUrl()` → `createSignedUrl(path, 3600)` （1時間期限付き署名URL）
  - `verifyApplicationAccess()` ヘルパーで申請所有権チェック
  - `deleteAttachment()` にパストラバーサル防止
  - admin/approver のみ削除可

### Phase 8: RLS強化・監査ログ改善 [完了]
- `supabase/migrations/00007_harden_rls_and_audit.sql` 新規作成
  - audit_logs INSERT: `WITH CHECK(TRUE)` → `user_id IS NULL OR user_id = auth.uid()`
  - notifications INSERT: `WITH CHECK(TRUE)` → `user_id = auth.uid() OR admin`
  - `ip_address`, `user_id` カラムの確保
  - `fee_settings` テーブルのRLS追加
- 全サーバーアクションの監査ログに `ip_address` と `user_id` を記録

---

## 未対応の残課題（次の開発で対応）

### 優先度: 高（次スプリント推奨）

#### TODO-1: Zodスキーマをサーバーアクションに組み込み
- **現状:** `src/lib/validations/schemas.ts` にスキーマ定義済みだが、各サーバーアクションで `.parse()` / `.safeParse()` を呼んでいない
- **対象ファイル:** `members.ts`（registerMember, updateMember）, `applications.ts`（createApplication）, `master.ts`（upsertCompany）, `fees.ts`（recordFeePayment）, `users.ts`（createUser）, `notifications.ts`（sendAdminNotification）
- **実装方法:** 各関数の先頭で `const validated = registerMemberSchema.safeParse(data)` → `if (!validated.success) return { success: false, error: validated.error.message }`
- **工数:** 0.5日

#### TODO-2: ログイン試行のレート制限 [完了]
- **実装:** Supabase DBベースのレート制限（外部依存なし）
- **方式:** IP単位で5回/15分の制限、`login_attempts` テーブルで追跡
- **変更ファイル:**
  - `supabase/migrations/00008_login_rate_limiting.sql` — テーブル + クリーンアップ関数
  - `src/lib/actions/login.ts` — `signIn()` サーバーアクション（レート制限チェック内蔵）
  - `src/app/(auth)/login/page.tsx` — クライアントサイド認証 → サーバーアクション変換
  - `src/app/(auth)/mypage-login/page.tsx` — 同上
- **動作:** 5回失敗 → フォーム無効化 + 待機時間メッセージ表示、失敗は監査ログ記録

#### TODO-3: 監査ログ書き込み失敗時の処理
- **現状:** 全ての監査ログinsertでエラーチェックなし。書き込み失敗しても操作は成功する
- **対策:** 監査ログ失敗時のエラーハンドリング追加（少なくともconsole.errorで記録、理想はトランザクション内でロールバック）
- **工数:** 0.5日

#### TODO-4: CORS設定
- **現状:** 明示的なCORS設定なし
- **対策:** `next.config.ts` で許可オリジンを制限
- **工数:** 0.5日

#### TODO-5: APIルートのCSRF対策
- **現状:** Server Actionsは Next.js 組み込みCSRF防御あり。3つのAPIルートにはなし
- **対策:** カスタムCSRFトークン検証、またはServer Actionsへの移行
- **工数:** 0.5日

### 優先度: 中（外部監査前に対応）

#### TODO-6: 銀行口座データの暗号化 [完了]
- **実装:** アプリケーションレベル AES-256-GCM 暗号化（Node.js crypto、外部依存なし）
- **保存形式:** `ENC:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
- **暗号化キー:** 環境変数 `ENCRYPTION_KEY`（64文字hex = 32バイト）
- **対象:** members テーブル7フィールド + payments テーブル5フィールド
- **変更ファイル:**
  - `src/lib/encryption.ts` — 暗号化/復号ユーティリティ
  - `src/lib/actions/members.ts` — 書き込み時暗号化 + 読み込み時復号
  - `src/lib/actions/payments.ts` — 読み込み時復号
  - `src/app/api/zengin-csv/route.ts` — 直接DBクエリ結果の復号
- **移行:** `scripts/migrate-encrypt-bank-data.ts`（冪等、`npx tsx` で実行）
- **注意:** コードデプロイ後に移行スクリプトを実行すること（平文/暗号文混在に対応済み）

#### TODO-7: ファイルアップロードのContent-Type実体検証
- **現状:** クライアントから渡された `contentType` をそのまま使用。拡張子偽装が可能
- **ファイル:** `src/lib/actions/attachments.ts`
- **対策:** サーバー側でマジックバイト（先頭数バイト）によるファイルタイプ検証
- **工数:** 0.5日

#### TODO-8: ストレージRLSポリシーのマイグレーション化
- **現状:** Supabaseダッシュボードでの手動設定のみ
- **対策:** SQLマイグレーションファイルにストレージバケットポリシーを記述
- **工数:** 0.5日

#### TODO-9: CAPTCHA導入
- **現状:** ログインページにCAPTCHAなし
- **対策:** Cloudflare Turnstile or hCaptcha（ログインN回失敗後に表示）
- **工数:** 1日

### 優先度: 低（推奨事項）

#### TODO-10: 自動脆弱性スキャン設定
- GitHub Dependabot + `npm audit` のCI統合
- **工数:** 0.5日

#### TODO-11: WAF導入
- Cloudflare または Vercel Firewall
- **工数:** 1日

#### TODO-12: 第三者ペネトレーションテスト
- 外部セキュリティ企業への委託
- **工数:** 外部委託

#### TODO-13: 多要素認証（MFA）
- FISC完全準拠には管理者アカウントへのMFAが必要
- Supabase Auth の MFA機能を利用
- **工数:** 1-2日

---

## アーキテクチャ概要（開発者向け）

### セキュリティレイヤー構成（Defense in Depth）

```
[ブラウザ] → [Vercel Edge] → [middleware.ts ルート保護]
                                      ↓
                              [Server Actions / API Routes]
                              - requireAuth() / requireRole()
                              - Zod バリデーション（TODO）
                                      ↓
                              [Supabase RLS ポリシー]
                              - テーブルレベルのアクセス制御
                              - get_user_role() / get_user_company_code()
```

### 認証・認可フロー

```
requireAuth()
  ├─ createServerSupabaseClient()
  ├─ supabase.auth.getUser() → 未認証 → throw AuthorizationError
  ├─ user_profiles.select() → プロフィールなし → throw AuthorizationError
  ├─ is_active チェック → 無効 → throw AuthorizationError
  └─ return { supabase, user, profile }

requireRole(['admin', 'approver'], { companyCode })
  ├─ requireAuth()
  ├─ profile.role チェック → 不一致 → throw AuthorizationError
  ├─ approver + companyCode → company_code 不一致 → throw AuthorizationError
  └─ return { supabase, user, profile }
```

### 主要ファイル一覧

| ファイル | 役割 |
|----------|------|
| `src/lib/errors.ts` | `AuthorizationError` クラス定義 |
| `src/lib/actions/auth.ts` | `requireAuth()`, `requireRole()`, `getClientIP()` |
| `src/lib/validations/schemas.ts` | Zodバリデーションスキーマ |
| `src/lib/encryption.ts` | AES-256-GCM 銀行データ暗号化/復号 |
| `src/lib/actions/login.ts` | `signIn()` サーバーアクション（レート制限内蔵） |
| `middleware.ts` | ルートレベルのロールベース保護 |
| `next.config.ts` | セキュリティヘッダー（HSTS, CSP, Permissions-Policy） |
| `supabase/migrations/00002_create_rls_policies.sql` | RLSポリシー（初期） |
| `supabase/migrations/00007_harden_rls_and_audit.sql` | RLS強化マイグレーション |

### ロール別アクセス権マトリックス

| 機能 | admin | approver | member |
|------|-------|----------|--------|
| ダッシュボード | 全社 | 自社スコープ | → mypage |
| 会員管理 | 全社 | 自社のみ | 自分のみ（閲覧） |
| 申請一覧 | 全社 | 自社のみ | 自分のみ |
| 申請作成 | 全社 | 自社会員分 | 自分分のみ |
| 各社承認 | 全社 | 自社のみ | 不可 |
| 本部承認 | 可 | 不可 | 不可 |
| 会費管理 | 全機能 | 閲覧のみ（自社） | 不可 |
| 支払管理 | 全機能 | 不可 | 不可 |
| マスター管理 | 全機能 | 不可 | 不可 |
| ユーザー管理 | 全機能 | 不可 | 不可 |
| ワークフロー | 全機能 | 不可 | 不可 |
| 統計 | 全社 | 自社スコープ | 不可 |
| CSV/PDF出力 | 可 | 不可 | 不可 |
| 通知 | 管理者配信可 | 自分の通知 | 自分の通知 |
| 添付ファイル | 全申請 | 自社申請 | 自分の申請 |

---

## 参考規格の対応状況

| 規格 | 対応前 | 対応後 | 残課題 |
|------|--------|--------|--------|
| JSOX（日本版SOX法） | 部分対応 | **概ね対応** | 監査ログ失敗処理 |
| FISC安全対策基準 | 未対応 | **概ね対応** | MFA |
| 個人情報保護法 | 部分対応 | **対応済み** | — |
| OWASP Top 10 | 部分対応 | **大幅改善** | CSRF（APIルート） |

---

## SQLマイグレーション実行メモ

`00007_harden_rls_and_audit.sql` は Supabase ダッシュボードの SQL Editor で手動実行が必要:

```bash
# ローカル開発の場合
supabase db push

# 本番の場合
# Supabase ダッシュボード → SQL Editor → ファイル内容を貼り付けて実行
```

---

*このドキュメントは2026年2月15日時点のコードベースに基づいています。セキュリティ対策の実施後に更新済み。*
