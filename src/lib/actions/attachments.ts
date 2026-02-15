'use server'

import { requireAuth, requireRole } from '@/lib/actions/auth'
import { AuthorizationError } from '@/lib/errors'

const BUCKET = 'attachments'

export interface AttachmentInfo {
  name: string
  path: string
  url: string
}

/**
 * 申請の所有権・アクセス権を検証するヘルパー。
 * - member: 自分の申請かどうかを member_id で確認
 * - approver: 自社の申請かどうかを company_code で確認
 * - admin: 常にアクセス可
 */
async function verifyApplicationAccess(
  supabase: Awaited<ReturnType<typeof requireAuth>>['supabase'],
  applicationId: string,
  profile: Awaited<ReturnType<typeof requireAuth>>['profile'],
): Promise<void> {
  const { data: app, error } = await supabase
    .from('applications')
    .select('member_id, company_code')
    .eq('application_id', applicationId)
    .single()

  if (error || !app) {
    throw new AuthorizationError('申請が見つかりません')
  }

  if (profile.role === 'member') {
    if (app.member_id !== profile.member_id) {
      throw new AuthorizationError('この申請へのアクセス権限がありません')
    }
  } else if (profile.role === 'approver') {
    if (app.company_code !== profile.company_code) {
      throw new AuthorizationError('この会社の申請にはアクセスできません')
    }
  }
  // admin は常にアクセス可
}

/**
 * 申請IDに紐づくファイル一覧を取得する
 * 署名付きURL（1時間有効）を返す。
 */
export async function getAttachments(applicationId: string): Promise<AttachmentInfo[]> {
  try {
    const { supabase, profile } = await requireAuth()

    // アクセス権チェック
    await verifyApplicationAccess(supabase, applicationId, profile)

    const folder = `applications/${applicationId}`
    const { data, error } = await supabase.storage.from(BUCKET).list(folder)

    if (error || !data) {
      console.error('getAttachments error:', error?.message)
      return []
    }

    const files = data.filter(f => f.name !== '.emptyFolderPlaceholder')

    // 署名付きURLを生成（1時間有効）
    const results: AttachmentInfo[] = []
    for (const f of files) {
      const path = `${folder}/${f.name}`
      const { data: signedData, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 3600)

      if (signError || !signedData) {
        console.error(`Failed to create signed URL for ${path}:`, signError?.message)
        continue
      }

      results.push({
        name: f.name,
        path,
        url: signedData.signedUrl,
      })
    }

    return results
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return []
    }
    throw err
  }
}

/**
 * ファイルをSupabase Storageにアップロードする
 */
export async function uploadAttachment(
  applicationId: string,
  fileName: string,
  fileData: ArrayBuffer,
  contentType: string,
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  try {
    const { supabase, profile } = await requireAuth()

    // アクセス権チェック
    await verifyApplicationAccess(supabase, applicationId, profile)

    // サイズチェック（5MB）
    if (fileData.byteLength > 5 * 1024 * 1024) {
      return { success: false, error: 'ファイルサイズは5MB以下にしてください' }
    }

    // 拡張子チェック
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
      return { success: false, error: '対応形式: JPG, PNG, PDF' }
    }

    const timestamp = Date.now()
    const safeName = `${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const path = `applications/${applicationId}/${safeName}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, fileData, {
        contentType,
        upsert: false,
      })

    if (error) {
      return { success: false, error: error.message }
    }

    // applicationsテーブルのattachmentsカラムを更新
    const existing = await getAttachments(applicationId)
    const paths = existing.map(a => a.path)
    if (!paths.includes(path)) paths.push(path)

    await supabase
      .from('applications')
      .update({ attachments: JSON.stringify(paths) })
      .eq('application_id', applicationId)

    return { success: true, path }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}

/**
 * ファイルを削除する（admin・approver専用）
 */
export async function deleteAttachment(
  applicationId: string,
  path: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, profile } = await requireRole(['admin', 'approver'])

    // パストラバーサル防止: パスが正しいプレフィックスで始まることを検証
    const expectedPrefix = `applications/${applicationId}/`
    if (!path.startsWith(expectedPrefix)) {
      return { success: false, error: '不正なファイルパスです' }
    }

    // approverの場合は自社の申請かチェック
    if (profile.role === 'approver') {
      await verifyApplicationAccess(supabase, applicationId, profile)
    }

    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) {
      return { success: false, error: error.message }
    }

    // applicationsテーブルのattachmentsカラムを更新
    const remaining = await getAttachments(applicationId)
    const paths = remaining.map(a => a.path).filter(p => p !== path)

    await supabase
      .from('applications')
      .update({ attachments: paths.length > 0 ? JSON.stringify(paths) : null })
      .eq('application_id', applicationId)

    return { success: true }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { success: false, error: err.message }
    }
    throw err
  }
}
