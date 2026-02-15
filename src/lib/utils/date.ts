import { format, differenceInYears, parseISO } from 'date-fns'

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy/MM/dd')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy/MM/dd HH:mm')
}

export function formatYearMonth(date: Date = new Date()): string {
  return format(date, 'yyyy-MM')
}

export function calculateMembershipYears(enrollmentDate: string | Date, baseDate: Date = new Date()): number {
  const enrollment = typeof enrollmentDate === 'string' ? parseISO(enrollmentDate) : enrollmentDate
  return differenceInYears(baseDate, enrollment)
}
