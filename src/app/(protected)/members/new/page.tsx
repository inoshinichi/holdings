import { getCompanies } from '@/lib/actions/master'
import { MemberForm } from '@/components/members/member-form'
import Link from 'next/link'

export default async function NewMemberPage() {
  const companies = await getCompanies()

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/members" className="hover:text-blue-600 transition">
          会員一覧
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">新規会員登録</span>
      </div>

      <h2 className="text-xl font-bold text-gray-800">新規会員登録</h2>

      <MemberForm companies={companies} />
    </div>
  )
}
