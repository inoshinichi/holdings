'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markAsRead, markAllAsRead } from '@/lib/actions/notifications'
import type { Notification } from '@/types/database'
import { Bell, CheckCheck, ExternalLink } from 'lucide-react'

const TYPE_STYLES: Record<string, { bg: string; dot: string }> = {
  approval: { bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  rejected: { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  paid: { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  admin: { bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  info: { bg: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
}

export function NotificationList({
  notifications: initialNotifications,
  userId,
}: {
  notifications: Notification[]
  userId: string
}) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifications.filter(n => !n.is_read).length

  function handleMarkAsRead(id: string) {
    startTransition(async () => {
      await markAsRead(id)
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n)),
      )
    })
  }

  function handleMarkAllAsRead() {
    startTransition(async () => {
      await markAllAsRead(userId)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    })
  }

  function handleClick(notification: Notification) {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-700">お知らせ</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            すべて既読にする
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.slice(0, 10).map(notification => {
          const style = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info
          const isUnread = !notification.is_read

          return (
            <div
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`rounded-lg border p-3 cursor-pointer transition hover:shadow-sm ${
                isUnread ? style.bg : 'bg-white border-gray-100 opacity-70'
              }`}
            >
              <div className="flex items-start gap-3">
                {isUnread && (
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${isUnread ? 'font-semibold text-gray-800' : 'font-medium text-gray-600'}`}>
                      {notification.title}
                    </p>
                    {notification.link && (
                      <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{notification.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(notification.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {notifications.length > 10 && (
        <p className="text-xs text-gray-400 text-center mt-3">
          最新10件を表示しています（全{notifications.length}件）
        </p>
      )}
    </div>
  )
}
