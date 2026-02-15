export const FEE_CATEGORIES = {
  '一般社員': 500,
  '係長以上': 1000,
  '部長職以上': 2000,
} as const

export type FeeCategoryKey = keyof typeof FEE_CATEGORIES

export function getFeeAmount(category: string): number {
  return FEE_CATEGORIES[category as FeeCategoryKey] ?? 500
}
