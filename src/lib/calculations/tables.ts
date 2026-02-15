export const FEE_CATEGORIES = {
  '一般社員': 500,
  '係長以上': 1000,
  '部長職以上': 2000,
} as const

export const ILLNESS_BENEFIT_TABLE = [
  { minSalary: 88000, maxSalary: 118000, benefit: 30000 },
  { minSalary: 126000, maxSalary: 150000, benefit: 45000 },
  { minSalary: 160000, maxSalary: 190000, benefit: 55000 },
  { minSalary: 200000, maxSalary: 240000, benefit: 65000 },
  { minSalary: 260000, maxSalary: 300000, benefit: 75000 },
  { minSalary: 320000, maxSalary: 360000, benefit: 95000 },
  { minSalary: 380000, maxSalary: 440000, benefit: 110000 },
  { minSalary: 470000, maxSalary: 530000, benefit: 130000 },
  { minSalary: 560000, maxSalary: 620000, benefit: 145000 },
  { minSalary: 650000, maxSalary: 9999999, benefit: 165000 },
] as const

export const ILLNESS_BENEFIT_PERIOD = {
  UNDER_5_YEARS: 6,
  UNDER_10_YEARS: 9,
  OVER_10_YEARS: 12,
} as const

export const ILLNESS_BENEFIT_MAX = 1_000_000

export const DISASTER_BENEFIT_TABLE = {
  TOTAL_LOSS: { own: 50000, other: 40000 },
  HALF_BURN: { own: 30000, other: 20000 },
  HALF_DAMAGE: { own: 15000, other: 10000 },
} as const

export const CONDOLENCE_BENEFIT_TABLE = {
  MEMBER: 50000,
  SPOUSE: 40000,
  PARENT: 20000,
  CHILD: 20000,
  GRANDPARENT_SIBLING: 10000,
} as const

export const MARRIAGE_BENEFIT_TABLE = {
  MEMBER: {
    UNDER_3_YEARS: { normal: 5000, remarriage: 3000 },
    UNDER_5_YEARS: { normal: 10000, remarriage: 5000 },
    OVER_5_YEARS: { normal: 20000, remarriage: 10000 },
  },
  CHILD: { normal: 5000, remarriage: 0 },
} as const

export const FAREWELL_BENEFIT_TABLE = {
  UNDER_10_YEARS: 5000,
  OVER_10_YEARS: 10000,
} as const
