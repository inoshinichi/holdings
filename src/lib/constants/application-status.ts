export const APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  COMPANY_APPROVED: 'COMPANY_APPROVED',
  HQ_APPROVED: 'HQ_APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  PENDING: '申請中',
  COMPANY_APPROVED: '各社承認済',
  HQ_APPROVED: '本部承認済',
  PAID: '支払完了',
  REJECTED: '差戻し',
  CANCELLED: 'キャンセル',
}

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPANY_APPROVED: 'bg-blue-100 text-blue-700',
  HQ_APPROVED: 'bg-cyan-100 text-cyan-700',
  PAID: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

export function getStatusLabel(status: string): string {
  return APPLICATION_STATUS_LABELS[status] ?? status
}

export function getStatusColor(status: string): string {
  return APPLICATION_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'
}
