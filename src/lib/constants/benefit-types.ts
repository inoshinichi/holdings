export const BENEFIT_TYPES = {
  MARRIAGE: { code: '01', name: '結婚祝金' },
  CHILDBIRTH: { code: '02', name: '出産祝金' },
  SCHOOL_ENROLLMENT: { code: '03', name: '入学祝金' },
  ILLNESS_INJURY: { code: '04', name: '傷病見舞金' },
  DISASTER: { code: '05', name: '災害見舞金' },
  CONDOLENCE: { code: '06', name: '弔慰金' },
  FAREWELL: { code: '07', name: '脱会餞別金' },
  RETIREMENT_GIFT: { code: '08', name: '定年退職記念品' },
} as const

export const BENEFIT_TYPE_LIST = Object.values(BENEFIT_TYPES)

export function getBenefitTypeName(code: string): string {
  const found = BENEFIT_TYPE_LIST.find(b => b.code === code)
  return found?.name ?? '不明'
}
