'use client'

import { useEffect, useState, useTransition } from 'react'
import { getUsers, createUser, updateUserProfile, resetUserPassword } from '@/lib/actions/users'
import { getCompanies } from '@/lib/actions/master'
import { getMembers } from '@/lib/actions/members'
import type { UserProfile, UserRole, Company, Member } from '@/types/database'
import { UserPlus, Shield, Key, Save, X, Users } from 'lucide-react'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  approver: '承認者',
  member: '会員',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  approver: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-700',
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createDisplayName, setCreateDisplayName] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('member')
  const [createCompanyCode, setCreateCompanyCode] = useState('')
  const [createMemberId, setCreateMemberId] = useState('')

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('member')
  const [editCompanyCode, setEditCompanyCode] = useState('')
  const [editMemberId, setEditMemberId] = useState('')

  // Password reset
  const [resetId, setResetId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [u, c, m] = await Promise.all([
        getUsers(),
        getCompanies(),
        getMembers(),
      ])
      setUsers(u)
      setCompanies(c)
      setMembers(m)
      setLoading(false)
    }
    load()
  }, [])

  async function reload() {
    const u = await getUsers()
    setUsers(u)
  }

  function handleCreate() {
    setError('')
    setMessage('')
    if (!createEmail || !createPassword) {
      setError('メールアドレスとパスワードは必須です')
      return
    }
    if (createPassword.length < 8) {
      setError('パスワードは8文字以上にしてください')
      return
    }
    if (!/[A-Z]/.test(createPassword) || !/[a-z]/.test(createPassword) || !/[0-9]/.test(createPassword)) {
      setError('パスワードには大文字・小文字・数字を含めてください')
      return
    }

    startTransition(async () => {
      const result = await createUser({
        email: createEmail,
        password: createPassword,
        displayName: createDisplayName || undefined,
        role: createRole,
        companyCode: createCompanyCode || undefined,
        memberId: createMemberId || undefined,
      })
      if (result.success) {
        setMessage(`ユーザー ${createEmail} を作成しました`)
        setShowCreate(false)
        setCreateEmail('')
        setCreatePassword('')
        setCreateDisplayName('')
        setCreateRole('member')
        setCreateCompanyCode('')
        setCreateMemberId('')
        await reload()
      } else {
        setError(result.error)
      }
    })
  }

  function startEdit(user: UserProfile) {
    setEditingId(user.id)
    setEditRole(user.role)
    setEditCompanyCode(user.company_code ?? '')
    setEditMemberId(user.member_id ?? '')
  }

  function handleSaveEdit() {
    if (!editingId) return
    setError('')
    setMessage('')

    startTransition(async () => {
      const result = await updateUserProfile(editingId, {
        role: editRole,
        companyCode: editCompanyCode || null,
        memberId: editMemberId || null,
      })
      if (result.success) {
        setMessage('ユーザー情報を更新しました')
        setEditingId(null)
        await reload()
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  function handleResetPassword() {
    if (!resetId || !newPassword) return
    if (newPassword.length < 8) {
      setError('パスワードは8文字以上にしてください')
      return
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('パスワードには大文字・小文字・数字を含めてください')
      return
    }
    setError('')
    setMessage('')

    startTransition(async () => {
      const result = await resetUserPassword(resetId, newPassword)
      if (result.success) {
        setMessage('パスワードをリセットしました')
        setResetId(null)
        setNewPassword('')
      } else {
        setError(result.error || 'エラーが発生しました')
      }
    })
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">読み込み中...</div>
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-800">ユーザー管理</h2>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          <UserPlus className="w-4 h-4" />
          新規ユーザー作成
        </button>
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">{message}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4">新規ユーザー作成</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
              <input type="email" className={inputClass} value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="user@vt-holdings.co.jp" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">パスワード *</label>
              <input type="password" className={inputClass} value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="8文字以上（大文字・小文字・数字を含む）" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
              <input className={inputClass} value={createDisplayName} onChange={e => setCreateDisplayName(e.target.value)} placeholder="山田 太郎" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ロール *</label>
              <select className={inputClass} value={createRole} onChange={e => setCreateRole(e.target.value as UserRole)}>
                <option value="member">会員</option>
                <option value="approver">承認者</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">会社コード</label>
              <select className={inputClass} value={createCompanyCode} onChange={e => setCreateCompanyCode(e.target.value)}>
                <option value="">-</option>
                {companies.map(c => (
                  <option key={c.company_code} value={c.company_code}>{c.company_name}（{c.company_code}）</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">会員ID（紐付け）</label>
              <select className={inputClass} value={createMemberId} onChange={e => setCreateMemberId(e.target.value)}>
                <option value="">-</option>
                {members.map(m => (
                  <option key={m.member_id} value={m.member_id}>{m.member_id} - {m.last_name} {m.first_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <UserPlus className="w-4 h-4" />
              作成
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Password reset dialog */}
      {resetId && (
        <div className="bg-white rounded-lg border border-yellow-200 p-6">
          <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-600" />
            パスワードリセット
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            対象: {users.find(u => u.id === resetId)?.email}
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
              <input type="password" className={inputClass} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8文字以上（大文字・小文字・数字を含む）" />
            </div>
            <button
              onClick={handleResetPassword}
              disabled={isPending || !newPassword}
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 transition"
            >
              リセット
            </button>
            <button
              onClick={() => { setResetId(null); setNewPassword('') }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">メールアドレス</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">表示名</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">ロール</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">会社コード</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">会員ID</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">状態</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    ユーザーがいません
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-800">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600">{user.display_name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {editingId === user.id ? (
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                          value={editRole}
                          onChange={e => setEditRole(e.target.value as UserRole)}
                        >
                          <option value="member">会員</option>
                          <option value="approver">承認者</option>
                          <option value="admin">管理者</option>
                        </select>
                      ) : (
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {editingId === user.id ? (
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-xs w-full"
                          value={editCompanyCode}
                          onChange={e => setEditCompanyCode(e.target.value)}
                        >
                          <option value="">-</option>
                          {companies.map(c => (
                            <option key={c.company_code} value={c.company_code}>{c.company_code}</option>
                          ))}
                        </select>
                      ) : (
                        user.company_code || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {editingId === user.id ? (
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-xs w-full"
                          value={editMemberId}
                          onChange={e => setEditMemberId(e.target.value)}
                        >
                          <option value="">-</option>
                          {members.map(m => (
                            <option key={m.member_id} value={m.member_id}>{m.member_id}</option>
                          ))}
                        </select>
                      ) : (
                        user.member_id || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingId === user.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => startEdit(user)}
                            className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200"
                          >
                            <Shield className="w-3 h-3" />
                            権限
                          </button>
                          <button
                            onClick={() => { setResetId(user.id); setNewPassword('') }}
                            className="inline-flex items-center gap-1 rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-200"
                          >
                            <Key className="w-3 h-3" />
                            PW
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {users.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">全 {users.length} 件</p>
          </div>
        )}
      </div>
    </div>
  )
}
