import Link from 'next/link'
import { ApplicationForm } from '@/components/applications/application-form'
import { ArrowLeft } from 'lucide-react'

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          申請一覧
        </Link>
        <h2 className="text-xl font-bold text-gray-800">新規申請</h2>
      </div>

      <ApplicationForm />
    </div>
  )
}
