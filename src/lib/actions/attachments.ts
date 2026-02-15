'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET = 'attachments'

export interface AttachmentInfo {
  name: string
  path: string
  url: string
}

/**
 * 申請IDに紐づくファイル一覧を取得する
 */
export async function getAttachments(applicationId: string): Promise<AttachmentInfo[]> {
  const supabase = await createServerSupabaseClient()

  const folder = `applications/${applicationId}`
  const { data, error } = await supabase.storage.from(BUCKET).list(folder)

  if (error || !data) {
    console.error('getAttachments error:', error?.message)
    return []
  }

  return data
    .filter(f => f.name !== '.emptyFolderPlaceholder')
    .map(f => {
      const path = `${folder}/${f.name}`
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return {
        name: f.name,
        path,
        url: urlData.publicUrl,
      }
    })
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
  const supabase = await createServerSupabaseClient()

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
}

/**
 * ファイルを削除する
 */
export async function deleteAttachment(
  applicationId: string,
  path: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()

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
}
