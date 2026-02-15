'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireAuth, requireRole, getClientIP } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'
import type { Notification, NotificationType } from '@/types/database'

// ---------------------------------------------------------------------------
// 通知取得
// ---------------------------------------------------------------------------

export async function getNotifications(userId: string, memberId?: string): Promise<Notification[]> {
  try {
    const { supabase, profile } = await requireAuth()

    // 他人の通知を読み取ることを防止
    if (userId !== profile.id) {
      throw new AuthorizationError('他のユーザーの通知にはアクセスできません')
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (memberId) {
      // member_idがnull（全員向け通知等）またはこの会員宛の通知のみ表示
      query = query.or(`member_id.is.null,member_id.eq.${memberId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('getNotifications error:', error.message)
      return []
    }

    return (data ?? []) as Notification[]
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return []
    }
    throw err
  }
}

export async function getUnreadCount(userId: string, memberId?: string): Promise<number> {
  try {
    const { supabase, profile } = await requireAuth()

    // 他人の未読数を読み取ることを防止
    if (userId !== profile.id) {
      throw new AuthorizationError('他のユーザーの通知にはアクセスできません')
    }

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (memberId) {
      query = query.or(`member_id.is.null,member_id.eq.${memberId}`)
    }

    const { count, error } = await query

    if (error) {
      console.error('getUnreadCount error:', error.message)
      return 0
    }

    return count ?? 0
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return 0
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 既読
// ---------------------------------------------------------------------------

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    const { supabase } = await requireAuth()

    // RLS handles ownership check
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return
    }
    throw err
  }
}

export async function markAllAsRead(userId: string, memberId?: string): Promise<void> {
  try {
    const { supabase, profile } = await requireAuth()

    // 他人の通知を更新することを防止
    if (userId !== profile.id) {
      throw new AuthorizationError('他のユーザーの通知は更新できません')
    }

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (memberId) {
      query = query.or(`member_id.is.null,member_id.eq.${memberId}`)
    }

    await query
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// 通知作成（内部ヘルパー - サーバーサイドからのみ呼び出すこと）
// NOTE: この関数は既に認証済みのコンテキストから呼び出されるため、
// 認証チェックは行わない。直接クライアントから呼び出さないこと。
// ---------------------------------------------------------------------------

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType = 'info',
  link?: string,
  memberId?: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  await supabase.from('notifications').insert({
    user_id: userId,
    member_id: memberId ?? null,
    title,
    message,
    type,
    link: link ?? null,
  })
}

// ---------------------------------------------------------------------------
// 管理者手動通知送信
// ---------------------------------------------------------------------------

export interface AdminNotificationInput {
  title: string
  message: string
  target: 'all' | 'company' | 'member'
  companyCode?: string
  memberId?: string
}

export async function sendAdminNotification(
  input: AdminNotificationInput,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  try {
    const { supabase, user } = await requireRole(['admin'])
    const ip = await getClientIP()

    if (!input.title.trim() || !input.message.trim()) {
      return { success: false, error: 'タイトルとメッセージを入力してください' }
    }

    // 送信先ユーザーを特定
    let targetUserIds: string[] = []
    let targetMemberId: string | null = null

    if (input.target === 'all') {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('is_active', true)
      targetUserIds = (users ?? []).map(u => u.id)
    } else if (input.target === 'company' && input.companyCode) {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('company_code', input.companyCode)
        .eq('is_active', true)
      targetUserIds = (users ?? []).map(u => u.id)
    } else if (input.target === 'member' && input.memberId) {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, member_id')
        .eq('member_id', input.memberId)
        .eq('is_active', true)
      targetUserIds = (users ?? []).map(u => u.id)
      targetMemberId = input.memberId
    } else {
      return { success: false, error: '送信先を正しく指定してください' }
    }

    if (targetUserIds.length === 0) {
      return { success: false, error: '送信先のユーザーが見つかりません' }
    }

    // 通知レコードを一括挿入
    const rows = targetUserIds.map(uid => ({
      user_id: uid,
      member_id: targetMemberId,
      title: input.title.trim(),
      message: input.message.trim(),
      type: 'admin' as const,
      link: null,
    }))

    const { error: insertError } = await supabase.from('notifications').insert(rows)
    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // 監査ログ
    await supabase.from('audit_logs').insert({
      user_email: user.email,
      operation_type: '通知送信',
      target: input.target === 'all' ? '全員' : input.target === 'company' ? input.companyCode : input.memberId,
      details: `${input.title}（${targetUserIds.length}名）`,
      ip_address: ip,
    })

    return { success: true, count: targetUserIds.length }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    const message = err instanceof Error ? err.message : '通知の送信に失敗しました'
    return { success: false, error: message }
  }
}
