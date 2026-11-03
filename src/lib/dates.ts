export const pad = (n: number) => String(n).padStart(2, '0')

export function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => fmt(new Date())

export function addDays(s: string, n: number): string {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
}

export function dow(s: string): number {
  return parse(s).getDay()
}

/** Monday-start week */
export function startOfWeek(s: string): string {
  const d = parse(s)
  const k = (d.getDay() + 6) % 7
  return addDays(s, -k)
}

export const startOfMonth = (s: string) => s.slice(0, 8) + '01'

export function endOfMonth(s: string): string {
  const d = parse(s)
  return fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export const startOfYear = (s: string) => s.slice(0, 4) + '-01-01'
export const endOfYear = (s: string) => s.slice(0, 4) + '-12-31'

export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export const shortDate = (s: string) =>
  parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export const longDate = (s: string) =>
  parse(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
