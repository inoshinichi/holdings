'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, getClientIP } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'
import type { UserProfile, UserRole } from '@/types/database'

export interface CreateUserInput {
  email: string
  password: string
  displayName?: string
  role: UserRole
  companyCode?: string
  memberId?: string
}

/**
 * ユーザー一覧を取得する（admin専用）
 */
export async function getUsers(): Promise<UserProfile[]> {
  try {
    const { supabase } = await requireRole(['admin'])

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('getUsers error:', error.message)
      return []
    }

    return (data ?? []) as UserProfile[]
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return []
    }
    throw err
  }
}

/**
 * ユーザーアカウントを作成する（admin専用）
 */
export async function createUser(
  input: CreateUserInput,
): Promise<{ success: true; userId: string } | { success: false; error: string }> {
  try {
    const { supabase, user } = await requireRole(['admin'])
    const ip = await getClientIP()

    // Create user via admin API
    const admin = createAdminClient()
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    })

    if (createError) {
      return { success: false, error: createError.message }
    }

    if (!newUser.user) {
      return { success: false, error: 'ユーザー作成に失敗しました' }
    }

    // Upsert user_profiles (trigger may not exist)
    const { error: profileError } = await admin
      .from('user_profiles')
      .upsert({
        id: newUser.user.id,
        email: input.email,
        display_name: input.displayName || null,
        role: input.role,
        company_code: input.companyCode || null,
        member_id: input.memberId || null,
        is_active: true,
      })

    if (profileError) {
      console.error('Profile upsert error:', profileError.message)
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_email: user.email,
      operation_type: 'ユーザー作成',
      target: input.email,
      details: `ロール: ${input.role}, 会社: ${input.companyCode || '-'}`,
      ip_address: ip,
    })

    return { success: true, userId: newUser.user.id }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}

/**
 * ユーザーのロール・プロフィールを更新する（admin専用）
 */
export async function updateUserProfile(
  userId: string,
  data: {
    role?: UserRole
    companyCode?: string | null
    memberId?: string | null
    displayName?: string | null
    isActive?: boolean
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireRole(['admin'])
    const ip = await getClientIP()

    const updates: Record<string, unknown> = {}
    if (data.role !== undefined) updates.role = data.role
    if (data.companyCode !== undefined) updates.company_code = data.companyCode
    if (data.memberId !== undefined) updates.member_id = data.memberId
    if (data.displayName !== undefined) updates.display_name = data.displayName
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const admin = createAdminClient()
    const { error: updateError } = await admin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_email: user.email,
      operation_type: 'ユーザー更新',
      target: userId,
      details: `更新: ${Object.keys(updates).join(', ')}`,
      ip_address: ip,
    })

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}

/**
 * ユーザーのパスワードをリセットする（admin専用）
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, user } = await requireRole(['admin'])
    const ip = await getClientIP()

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_email: user.email,
      operation_type: 'パスワードリセット',
      target: userId,
      ip_address: ip,
    })

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}
