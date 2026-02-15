import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import {
  Users, CheckSquare, DollarSign, Building2,
  FileText, FilePlus, CreditCard, BarChart3
} from 'lucide-react'
import type { UserProfile } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, company_code')
    .eq('id', user.id)
    .single()

  // Member role: redirect to mypage (their combined home)
  if (profile?.role === 'member') {
    redirect('/mypage')
  }

  const typedProfile = profile as Pick<UserProfile, 'role' | 'company_code'> | null
  const isApprover = typedProfile?.role === 'approver'
  const companyCode = isApprover ? (typedProfile?.company_code ?? undefined) : undefined

  // Build queries with optional company scope
  let memberQuery = supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('employment_status', '在職中')
  if (companyCode) memberQuery = memberQuery.eq('company_code', companyCode)

  let pendingQuery = supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .in('status', ['PENDING', 'COMPANY_APPROVED'])
  if (companyCode) pendingQuery = pendingQuery.eq('company_code', companyCode)

  const { count: memberCount } = await memberQuery
  const { count: pendingCount } = await pendingQuery

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  let paidQuery = supabase
    .from('applications')
    .select('final_amount')
    .eq('status', 'PAID')
    .gte('payment_completed_date', monthStart)
  if (companyCode) paidQuery = paidQuery.eq('company_code', companyCode)

  const { data: paidApps } = await paidQuery
  const monthlyBenefit = paidApps?.reduce((sum, a) => sum + (a.final_amount || 0), 0) ?? 0

  const stats = isApprover
    ? [
        { label: '自社会員数', value: String(memberCount ?? 0), icon: Users, color: 'text-blue-600 bg-blue-50', href: '/members' },
        { label: '承認待ち', value: String(pendingCount ?? 0), icon: CheckSquare, color: 'text-yellow-600 bg-yellow-50', href: '/approvals' },
        { label: '今月給付金', value: formatCurrency(monthlyBenefit), icon: DollarSign, color: 'text-green-600 bg-green-50', href: '/statistics' },
      ]
    : [
        { label: '会員数', value: String(memberCount ?? 0), icon: Users, color: 'text-blue-600 bg-blue-50', href: '/members' },
        { label: '承認待ち', value: String(pendingCount ?? 0), icon: CheckSquare, color: 'text-yellow-600 bg-yellow-50', href: '/approvals' },
        { label: '今月給付金', value: formatCurrency(monthlyBenefit), icon: DollarSign, color: 'text-green-600 bg-green-50', href: '/statistics' },
        { label: '加盟会社', value: '', icon: Building2, color: 'text-purple-600 bg-purple-50', href: '/master' },
      ]

  // For admin, fetch company count
  if (!isApprover) {
    const { count: companyCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    const companyStat = stats.find(s => s.label === '加盟会社')
    if (companyStat) companyStat.value = String(companyCount ?? 0)
  }

  const quickLinks = [
    { href: '/applications', label: '申請一覧', icon: FileText, roles: ['admin', 'approver'] },
    { href: '/applications/new', label: '新規申請', icon: FilePlus, roles: ['admin', 'approver'] },
    { href: '/approvals', label: '承認待ち', icon: CheckSquare, roles: ['admin', 'approver'] },
    { href: '/members', label: '会員一覧', icon: Users, roles: ['admin', 'approver'] },
    { href: '/statistics', label: '給付金統計', icon: BarChart3, roles: ['admin', 'approver'] },
    { href: '/payments', label: '支払管理', icon: CreditCard, roles: ['admin'] },
    { href: '/mypage', label: 'マイページ', icon: Users, roles: ['member'] },
  ].filter(link => link.roles.includes(typedProfile?.role ?? 'member'))

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-800">ダッシュボード</h2>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isApprover ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4`}>
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition cursor-pointer">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3">クイックアクセス</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map(link => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3 hover:border-blue-300 hover:shadow-sm transition"
              >
                <Icon className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
