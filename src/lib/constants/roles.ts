import type { UserRole } from '@/types/database'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者（本部）',
  approver: '承認者（各社）',
  member: '一般会員',
}

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? '不明'
}
