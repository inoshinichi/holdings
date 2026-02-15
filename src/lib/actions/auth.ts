'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { UserProfile, UserRole } from '@/types/database'
import { AuthorizationError } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---------------------------------------------------------------------------
// getCurrentUser (backward compatible)
// ---------------------------------------------------------------------------

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

type AuthResult = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  user: { id: string; email: string }
  profile: UserProfile
}

/**
 * 認証を必須とし、supabase client + user + typed profile を返す。
 * 未認証時またはプロフィール未取得時は AuthorizationError をthrowする。
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthorizationError('認証が必要です')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    throw new AuthorizationError('有効なユーザープロフィールが見つかりません')
  }

  const typedProfile = profile as UserProfile

  if (!typedProfile.is_active) {
    throw new AuthorizationError('このアカウントは無効です')
  }

  return {
    supabase,
    user: { id: user.id, email: user.email ?? '' },
    profile: typedProfile,
  }
}

/**
 * ロールを必須とし、指定されたロールに合致しない場合は AuthorizationError をthrowする。
 * approverの場合、options.companyCode を指定すると自社スコープチェックも行う。
 */
export async function requireRole(
  allowedRoles: UserRole[],
  options?: { companyCode?: string },
): Promise<AuthResult> {
  const result = await requireAuth()

  if (!allowedRoles.includes(result.profile.role)) {
    throw new AuthorizationError(
      `この操作には${allowedRoles.map(r =>
        r === 'admin' ? '管理者' : r === 'approver' ? '承認者' : '会員'
      ).join('または')}権限が必要です`
    )
  }

  if (
    result.profile.role === 'approver' &&
    options?.companyCode &&
    result.profile.company_code !== options.companyCode
  ) {
    throw new AuthorizationError('この会社のデータにアクセスする権限がありません')
  }

  return result
}

/**
 * リクエストヘッダーからクライアントIPアドレスを取得する。
 */
export async function getClientIP(): Promise<string | null> {
  try {
    const headersList = await headers()
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headersList.get('x-real-ip') ??
      null
    )
  } catch {
    return null
  }
}
