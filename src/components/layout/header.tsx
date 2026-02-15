'use client'

import type { UserProfile } from '@/types/database'
import { getRoleLabel } from '@/lib/constants/roles'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function Header({ profile }: { profile: UserProfile }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {profile.display_name || profile.email}
          </p>
          <p className="text-xs text-gray-500">
            {getRoleLabel(profile.role)}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 text-gray-400 hover:text-red-600 transition"
          title="ログアウト"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
