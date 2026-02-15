import type { BenefitCalculationResult, CalculationParams, Member } from '@/types/database'
import { calculateMembershipYears } from '@/lib/utils/date'
import {
  MARRIAGE_BENEFIT_TABLE,
  ILLNESS_BENEFIT_TABLE,
  ILLNESS_BENEFIT_PERIOD,
  ILLNESS_BENEFIT_MAX,
  DISASTER_BENEFIT_TABLE,
  CONDOLENCE_BENEFIT_TABLE,
  FAREWELL_BENEFIT_TABLE,
} from './tables'

export function calculateBenefit(
  benefitTypeCode: string,
  params: CalculationParams,
  member: Member
): BenefitCalculationResult {
  switch (benefitTypeCode) {
    case '01': return calculateMarriageBenefit(params, member)
    case '02': return calculateChildbirthBenefit(params)
    case '03': return calculateSchoolEnrollmentBenefit(params)
    case '04': return calculateIllnessInjuryBenefit(params, member)
    case '05': return calculateDisasterBenefit(params)
    case '06': return calculateCondolenceBenefit(params)
    case '07': return calculateFarewellBenefit(params, member)
    case '08': return calculateRetirementGiftBenefit()
    default: throw new Error(`不明な給付金種別: ${benefitTypeCode}`)
  }
}

function calculateMarriageBenefit(params: CalculationParams, member: Member): BenefitCalculationResult {
  const membershipYears = calculateMembershipYears(
    member.enrollment_date,
    params.eventDate ? new Date(params.eventDate) : new Date()
  )
  const isRemarriage = params.isRemarriage ?? false
  const isForChild = params.isForChild ?? false

  let amount = 0
  let details = ''

  if (isForChild) {
    amount = isRemarriage ? MARRIAGE_BENEFIT_TABLE.CHILD.remarriage : MARRIAGE_BENEFIT_TABLE.CHILD.normal
    details = `会員の子の結婚（${isRemarriage ? '再婚' : '初婚'}）`
  } else {
    if (membershipYears < 3) {
      amount = isRemarriage ? MARRIAGE_BENEFIT_TABLE.MEMBER.UNDER_3_YEARS.remarriage : MARRIAGE_BENEFIT_TABLE.MEMBER.UNDER_3_YEARS.normal
      details = `入会後3年未満（${membershipYears}年）、${isRemarriage ? '再婚' : '初婚'}`
    } else if (membershipYears < 5) {
      amount = isRemarriage ? MARRIAGE_BENEFIT_TABLE.MEMBER.UNDER_5_YEARS.remarriage : MARRIAGE_BENEFIT_TABLE.MEMBER.UNDER_5_YEARS.normal
      details = `入会後3年以上5年未満（${membershipYears}年）、${isRemarriage ? '再婚' : '初婚'}`
    } else {
      amount = isRemarriage ? MARRIAGE_BENEFIT_TABLE.MEMBER.OVER_5_YEARS.remarriage : MARRIAGE_BENEFIT_TABLE.MEMBER.OVER_5_YEARS.normal
      details = `入会後5年以上（${membershipYears}年）、${isRemarriage ? '再婚' : '初婚'}`
    }
  }

  return { benefitType: '結婚祝金', amount, membershipYears, calculationDetails: details }
}

function calculateChildbirthBenefit(params: CalculationParams): BenefitCalculationResult {
  const baseAmount = 10000
  const childCount = params.childCount ?? 1
  const isStillbirth = params.isStillbirth ?? false
  const amount = baseAmount * childCount

  let details = ''
  if (isStillbirth) {
    details = '死産のため弔慰金として贈与'
  } else if (childCount > 1) {
    details = `${childCount}子（双生児以上のため加算）`
  } else {
    details = '出産'
  }

  return {
    benefitType: isStillbirth ? '弔慰金（死産）' : '出産祝金',
    amount,
    calculationDetails: details,
  }
}

function calculateSchoolEnrollmentBenefit(params: CalculationParams): BenefitCalculationResult {
  const amount = 8000
  const schoolType = params.schoolType ?? '小学校'

  return {
    benefitType: '入学祝金',
    amount,
    calculationDetails: `${schoolType}入学`,
  }
}

function calculateIllnessInjuryBenefit(params: CalculationParams, member: Member): BenefitCalculationResult {
  const salary = params.standardMonthlyRemuneration ?? member.standard_monthly_remuneration ?? 0
  const membershipYears = calculateMembershipYears(
    member.enrollment_date,
    params.eventDate ? new Date(params.eventDate) : new Date()
  )
  const absenceDays = params.absenceDays ?? 30

  let monthlyBenefit = 0
  for (const tier of ILLNESS_BENEFIT_TABLE) {
    if (salary >= tier.minSalary && salary <= tier.maxSalary) {
      monthlyBenefit = tier.benefit
      break
    }
  }

  let maxPeriodMonths = 0
  if (membershipYears < 5) {
    maxPeriodMonths = ILLNESS_BENEFIT_PERIOD.UNDER_5_YEARS
  } else if (membershipYears < 10) {
    maxPeriodMonths = ILLNESS_BENEFIT_PERIOD.UNDER_10_YEARS
  } else {
    maxPeriodMonths = ILLNESS_BENEFIT_PERIOD.OVER_10_YEARS
  }

  const dailyBenefit = monthlyBenefit / 30
  let amount = Math.round(dailyBenefit * absenceDays)
  if (amount > ILLNESS_BENEFIT_MAX) {
    amount = ILLNESS_BENEFIT_MAX
  }

  return {
    benefitType: '傷病見舞金',
    amount,
    monthlyBenefit,
    standardMonthlyRemuneration: salary,
    membershipYears,
    maxPeriodMonths,
    absenceDays,
    calculationDetails: `標準報酬月額 ${salary.toLocaleString()}円、月額見舞金 ${monthlyBenefit.toLocaleString()}円、欠勤${absenceDays}日、贈与期間上限 ${maxPeriodMonths}ヶ月`,
  }
}

function calculateDisasterBenefit(params: CalculationParams): BenefitCalculationResult {
  const damageLevel = params.damageLevel ?? 'HALF_DAMAGE'
  const isOwnHouse = params.isOwnHouse ?? true
  const isHeadOfHousehold = params.isHeadOfHousehold ?? true

  let baseAmount = 0
  let damageName = ''

  switch (damageLevel) {
    case 'TOTAL_LOSS':
      baseAmount = isOwnHouse ? DISASTER_BENEFIT_TABLE.TOTAL_LOSS.own : DISASTER_BENEFIT_TABLE.TOTAL_LOSS.other
      damageName = '全焼・流失'
      break
    case 'HALF_BURN':
      baseAmount = isOwnHouse ? DISASTER_BENEFIT_TABLE.HALF_BURN.own : DISASTER_BENEFIT_TABLE.HALF_BURN.other
      damageName = '半焼・全壊'
      break
    case 'HALF_DAMAGE':
    default:
      baseAmount = isOwnHouse ? DISASTER_BENEFIT_TABLE.HALF_DAMAGE.own : DISASTER_BENEFIT_TABLE.HALF_DAMAGE.other
      damageName = '半壊・床上浸水'
      break
  }

  const amount = isHeadOfHousehold ? baseAmount : Math.floor(baseAmount / 2)

  return {
    benefitType: '災害見舞金',
    amount,
    damageLevel: damageName,
    isOwnHouse,
    isHeadOfHousehold,
    calculationDetails: `${damageName}、${isOwnHouse ? '自家' : 'その他'}、${isHeadOfHousehold ? '世帯主' : '非世帯主（半額）'}`,
  }
}

function calculateCondolenceBenefit(params: CalculationParams): BenefitCalculationResult {
  const relationship = params.relationship ?? 'MEMBER'
  const isChiefMourner = params.isChiefMourner ?? true

  let baseAmount = 0
  let relationshipName = ''

  switch (relationship) {
    case 'MEMBER':
      baseAmount = CONDOLENCE_BENEFIT_TABLE.MEMBER
      relationshipName = '会員本人'
      break
    case 'SPOUSE':
      baseAmount = CONDOLENCE_BENEFIT_TABLE.SPOUSE
      relationshipName = '配偶者'
      break
    case 'PARENT':
      baseAmount = CONDOLENCE_BENEFIT_TABLE.PARENT
      relationshipName = '父母'
      break
    case 'CHILD':
      baseAmount = CONDOLENCE_BENEFIT_TABLE.CHILD
      relationshipName = '子'
      break
    case 'GRANDPARENT_SIBLING':
      baseAmount = CONDOLENCE_BENEFIT_TABLE.GRANDPARENT_SIBLING
      relationshipName = '祖父母・兄弟姉妹'
      break
    default:
      throw new Error(`不明な続柄: ${relationship}`)
  }

  let amount = baseAmount
  if (!isChiefMourner && ['PARENT', 'CHILD', 'GRANDPARENT_SIBLING'].includes(relationship)) {
    amount = Math.floor(baseAmount / 2)
  }

  return {
    benefitType: '弔慰金',
    amount,
    relationship: relationshipName,
    isChiefMourner,
    calculationDetails: `${relationshipName}の死亡、${isChiefMourner ? '喪主' : '非喪主（半額）'}`,
  }
}

function calculateFarewellBenefit(params: CalculationParams, member: Member): BenefitCalculationResult {
  const membershipYears = calculateMembershipYears(
    member.enrollment_date,
    params.withdrawalDate ? new Date(params.withdrawalDate) : new Date()
  )

  let amount = 0
  let details = ''

  if (membershipYears < 3) {
    amount = 0
    details = '入会後3年未満のため対象外'
  } else if (membershipYears < 10) {
    amount = FAREWELL_BENEFIT_TABLE.UNDER_10_YEARS
    details = `入会後3年以上10年未満（${membershipYears}年）`
  } else {
    amount = FAREWELL_BENEFIT_TABLE.OVER_10_YEARS
    details = `入会後10年以上（${membershipYears}年）`
  }

  return {
    benefitType: '脱会餞別金',
    amount,
    membershipYears,
    calculationDetails: details,
  }
}

function calculateRetirementGiftBenefit(): BenefitCalculationResult {
  return {
    benefitType: '定年退職記念品',
    amount: 10000,
    calculationDetails: '定年退職記念品（10,000円相当）',
  }
}
