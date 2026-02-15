'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { UserRole } from '@/types/database'
import {
  Home, Users, UserPlus, FileText, FilePlus, CheckSquare,
  DollarSign, CreditCard, BarChart3, Database, User, Shield, GitBranch, Bell
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'ホーム', icon: Home, roles: ['admin', 'approver'] },
  { href: '/mypage', label: 'マイページ', icon: User, roles: ['admin', 'approver', 'member'] },
  { href: '/applications/new', label: '新規申請', icon: FilePlus, roles: ['admin', 'approver', 'member'] },
  { href: '/members', label: '会員一覧', icon: Users, roles: ['admin', 'approver'] },
  { href: '/members/new', label: '会員登録', icon: UserPlus, roles: ['admin', 'approver'] },
  { href: '/applications', label: '申請一覧', icon: FileText, roles: ['admin', 'approver'] },
  { href: '/approvals', label: '承認待ち', icon: CheckSquare, roles: ['admin', 'approver'] },
  { href: '/fees', label: '会費管理', icon: DollarSign, roles: ['admin', 'approver'] },
  { href: '/payments', label: '支払管理', icon: CreditCard, roles: ['admin'] },
  { href: '/statistics', label: '統計', icon: BarChart3, roles: ['admin', 'approver'] },
  { href: '/workflow', label: '承認ワークフロー', icon: GitBranch, roles: ['admin'] },
  { href: '/notifications', label: '通知管理', icon: Bell, roles: ['admin'] },
  { href: '/master', label: 'マスター管理', icon: Database, roles: ['admin'] },
  { href: '/users', label: 'ユーザー管理', icon: Shield, roles: ['admin'] },
]

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const filteredItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  return (
    <nav className="w-60 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-sm font-bold text-blue-600 leading-tight">
          VTホールディングスグループ
          <br />
          共済会システム
        </h1>
      </div>
      <ul className="flex-1 p-2 space-y-0.5">
        {filteredItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && item.href !== '/mypage' && pathname.startsWith(item.href))
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
