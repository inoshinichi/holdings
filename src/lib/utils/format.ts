export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '¥0'
  return `¥${amount.toLocaleString()}`
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0'
  return n.toLocaleString()
}
