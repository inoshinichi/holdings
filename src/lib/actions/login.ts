'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getClientIP } from '@/lib/actions/auth'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15

interface SignInResult {
  success: boolean
  error?: string
  rateLimited?: boolean
}

async function checkRateLimit(
  ip: string,
): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number }> {
  const admin = createAdminClient()

  // 古いレコードをクリーンアップ
  await admin.rpc('cleanup_old_login_attempts')

  // ウィンドウ内の失敗回数をカウント
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

  const { count, error } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('attempted_at', windowStart)

  if (error) {
    console.error('Rate limit check error:', error.message)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }

  const failedCount = count ?? 0

  if (failedCount >= MAX_ATTEMPTS) {
    const { data: oldest } = await admin
      .from('login_attempts')
      .select('attempted_at')
      .eq('ip_address', ip)
      .eq('success', false)
      .gte('attempted_at', windowStart)
      .order('attempted_at', { ascending: true })
      .limit(1)

    let retryAfterSeconds = WINDOW_MINUTES * 60
    if (oldest && oldest.length > 0) {
      const oldestTime = new Date(oldest[0].attempted_at).getTime()
      const windowEnd = oldestTime + WINDOW_MINUTES * 60 * 1000
      retryAfterSeconds = Math.max(0, Math.ceil((windowEnd - Date.now()) / 1000))
    }

    return { allowed: false, remainingAttempts: 0, retryAfterSeconds }
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - failedCount }
}

async function recordLoginAttempt(
  ip: string,
  email: string,
  success: boolean,
): Promise<void> {
  const admin = createAdminClient()

  await admin.from('login_attempts').insert({
    ip_address: ip,
    email,
    success,
  })

  if (!success) {
    await admin.from('audit_logs').insert({
      user_email: email,
      ip_address: ip,
      operation_type: 'ログイン失敗',
      target: 'auth',
      details: `ログイン試行失敗 (IP: ${ip})`,
    })
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const ip = (await getClientIP()) ?? 'unknown'

  // 1. レート制限チェック
  const rateCheck = await checkRateLimit(ip)
  if (!rateCheck.allowed) {
    const minutes = Math.ceil((rateCheck.retryAfterSeconds ?? 900) / 60)
    return {
      success: false,
      error: `ログイン試行回数が上限に達しました。${minutes}分後に再試行してください。`,
      rateLimited: true,
    }
  }

  // 2. Supabase認証
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    await recordLoginAttempt(ip, email, false)

    const remaining = rateCheck.remainingAttempts - 1
    let errorMessage = 'メールアドレスまたはパスワードが正しくありません'
    if (remaining <= 2 && remaining > 0) {
      errorMessage += `（残り${remaining}回）`
    }

    return { success: false, error: errorMessage }
  }

  // 3. 成功
  await recordLoginAttempt(ip, email, true)
  return { success: true }
}
