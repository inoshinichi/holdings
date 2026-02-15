import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getMember } from '@/lib/actions/members'
import { getApplications } from '@/lib/actions/applications'
import { getNotifications } from '@/lib/actions/notifications'
import { getStatusLabel, getStatusColor } from '@/lib/constants/application-status'
import { formatCurrency } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import type { UserProfile } from '@/types/database'
import Link from 'next/link'
import { User, Building2, Calendar, CreditCard, Tag, FileText, FilePlus, Shield, CheckSquare, Users as UsersIcon, Bell } from 'lucide-react'
import { NotificationList } from '@/components/notifications/notification-list'

export default async function MyPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const typedProfile = profile as UserProfile

  // If user has no member_id, show role-appropriate page
  if (!typedProfile.member_id) {
    const ROLE_LABELS: Record<string, string> = { admin: '管理者', approver: '承認者', member: '会員' }
    const ROLE_COLORS: Record<string, string> = { admin: 'bg-red-100 text-red-700', approver: 'bg-blue-100 text-blue-700', member: 'bg-gray-100 text-gray-700' }

    // For admin/approver, show account info and quick links
    if (typedProfile.role === 'admin' || typedProfile.role === 'approver') {
      const notifications = await getNotifications(user.id)
      let pendingCount = 0
      let memberCount = 0
      try {
        const pendingResult = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .in('status', ['PENDING', 'COMPANY_APPROVED'])
        pendingCount = pendingResult.count ?? 0

        const memberResult = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('employment_status', '在職中')
        memberCount = memberResult.count ?? 0
      } catch {
        // Ignore query errors for stats
      }

      return (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">マイページ</h2>

          {/* Notifications */}
          {notifications.length > 0 && (
            <NotificationList notifications={notifications} userId={user.id} />
          )}

          {/* Account info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-blue-50">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {typedProfile.display_name || typedProfile.email}
                </h3>
                <p className="text-sm text-gray-400">{typedProfile.email}</p>
              </div>
              <div className="ml-auto">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${ROLE_COLORS[typedProfile.role]}`}>
                  {ROLE_LABELS[typedProfile.role]}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoItem icon={Shield} label="ロール" value={ROLE_LABELS[typedProfile.role]} />
              <InfoItem icon={Building2} label="会社コード" value={typedProfile.company_code || '-'} />
              <InfoItem icon={Tag} label="ユーザーID" value={typedProfile.id.slice(0, 8) + '...'} />
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/approvals" className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition">
              <div className="p-3 rounded-lg bg-yellow-50">
                <CheckSquare className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{pendingCount ?? 0}</p>
                <p className="text-sm text-gray-500">承認待ち</p>
              </div>
            </Link>
            <Link href="/members" className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition">
              <div className="p-3 rounded-lg bg-blue-50">
                <UsersIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800">{memberCount ?? 0}</p>
                <p className="text-sm text-gray-500">在籍会員</p>
              </div>
            </Link>
          </div>
        </div>
      )
    }

    // For member role without linked member_id
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800">マイページ</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            会員情報が紐付けられていません
          </p>
          <p className="text-gray-400 text-xs mt-2">
            管理者にお問い合わせください。
          </p>
        </div>
      </div>
    )
  }

  // Fetch member details, applications, and notifications in parallel
  const [member, applications, notifications] = await Promise.all([
    getMember(typedProfile.member_id),
    getApplications({ memberId: typedProfile.member_id }),
    getNotifications(user.id, typedProfile.member_id),
  ])

  if (!member) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-800">マイページ</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            会員情報が見つかりません
          </p>
        </div>
      </div>
    )
  }

  const STATUS_BADGE: Record<string, string> = {
    '在職中': 'bg-green-100 text-green-700',
    '休会中': 'bg-yellow-100 text-yellow-700',
    '退会':   'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">マイページ</h2>
        <Link
          href="/applications/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <FilePlus className="w-4 h-4" />
          新規申請
        </Link>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <NotificationList notifications={notifications} userId={user.id} memberId={typedProfile.member_id} />
      )}

      {/* Member info card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-full bg-blue-50">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {member.last_name} {member.first_name}
            </h3>
            {member.last_name_kana && member.first_name_kana && (
              <p className="text-sm text-gray-400">
                {member.last_name_kana} {member.first_name_kana}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                STATUS_BADGE[member.employment_status] ?? 'bg-gray-100 text-gray-500'
              }`}
            >
              {member.employment_status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem
            icon={Tag}
            label="会員ID"
            value={member.member_id}
          />
          <InfoItem
            icon={Building2}
            label="会社"
            value={member.company_name}
          />
          <InfoItem
            icon={Calendar}
            label="入会日"
            value={formatDate(member.enrollment_date)}
          />
          <InfoItem
            icon={CreditCard}
            label="会費区分"
            value={member.fee_category}
          />
          <InfoItem
            icon={CreditCard}
            label="会費金額"
            value={formatCurrency(member.fee_amount)}
          />
          {member.email && (
            <InfoItem
              icon={User}
              label="メールアドレス"
              value={member.email}
            />
          )}
        </div>
      </div>

      {/* Application history */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-700">申請履歴</h3>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">申請ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">申請日</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">給付金種別</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">金額</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      申請履歴がありません
                    </td>
                  </tr>
                ) : (
                  applications.map(app => (
                    <tr key={app.application_id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {app.application_id}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatDate(app.application_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {app.benefit_type_name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 font-medium tabular-nums">
                        {formatCurrency(app.final_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(app.status)}`}
                        >
                          {getStatusLabel(app.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {applications.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">
                全 {applications.length} 件
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Info Item sub-component
// ---------------------------------------------------------------------------

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  )
}
