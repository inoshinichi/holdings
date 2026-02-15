import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApplicationForm } from '@/components/applications/application-form'
import { ArrowLeft } from 'lucide-react'
import type { UserProfile } from '@/types/database'

export default async function NewApplicationPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let selfMemberId: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, member_id')
      .eq('id', user.id)
      .single()
    const typedProfile = profile as Pick<UserProfile, 'role' | 'member_id'> | null
    if (typedProfile?.role === 'member' && typedProfile.member_id) {
      selfMemberId = typedProfile.member_id
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={selfMemberId ? '/mypage' : '/applications'}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          {selfMemberId ? 'マイページ' : '申請一覧'}
        </Link>
        <h2 className="text-xl font-bold text-gray-800">新規申請</h2>
      </div>

      <ApplicationForm selfMemberId={selfMemberId} />
    </div>
  )
}
