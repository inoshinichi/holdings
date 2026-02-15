'use client'

import { useEffect, useState } from 'react'
import type { UserProfile } from '@/types/database'
import { getRoleLabel } from '@/lib/constants/roles'
import { Bell, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getUnreadCount } from '@/lib/actions/notifications'

export function Header({ profile }: { profile: UserProfile }) {
  const router = useRouter()
  const supabase = createClient()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    getUnreadCount(profile.id).then(setUnreadCount)
  }, [profile.id])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button
          onClick={() => router.push('/mypage')}
          className="relative p-2 text-gray-400 hover:text-blue-600 transition"
          title="お知らせ"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

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
