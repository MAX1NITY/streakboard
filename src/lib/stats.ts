import type { Completion, Data, Goal, Task } from './types'
import { addDays, diffDays, dow, eachDay, startOfWeek } from './dates'

export type CompletionMap = Map<string, Completion>

export function completionMap(cs: Completion[]): CompletionMap {
  const m = new Map<string, Completion>()
  for (const c of cs) m.set(c.task_id + '|' + c.date, c)
  return m
}

export const isWeekly = (t: Task) => t.type === 'recurring' && !!t.weekly_target

export interface WeekProgress {
  done: number // completions Mon..date inclusive
  need: number // quota for this week (capped by days the task is active)
  daysAfter: number // active days left in the week after `date`
  doneToday: boolean
}

export function weekProgress(t: Task, date: string, cm: CompletionMap): WeekProgress {
  const ws = startOfWeek(date)
  const we = addDays(ws, 6)
  const from = ws < t.start_date ? t.start_date : ws
  const to = t.end_date && t.end_date < we ? t.end_date : we
  const avail = Math.max(0, diffDays(from, to) + 1)
  const need = Math.min(t.weekly_target ?? 0, avail)
  let done = 0
  for (let d = from; d <= date; d = addDays(d, 1)) if (cm.has(t.id + '|' + d)) done++
  return { done, need, daysAfter: Math.max(0, diffDays(date, to)), doneToday: cm.has(t.id + '|' + date) }
}

/**
 * Is this task expected on this date?
 * Weekly-target tasks (N times a week, any days) count on a day when it was done
 * (within quota) or when the day is already "forced": too few days remain in the
 * week to still reach the quota. So a missed day only counts once it truly hurts.
 */
export function isScheduled(t: Task, date: string, cm?: CompletionMap): boolean {
  if (t.archived) return false
  if (t.type === 'oneoff') return date === (t.end_date ?? t.start_date)
  if (date < t.start_date) return false
  if (t.end_date && date > t.end_date) return false
  if (t.weekly_target) {
    const wp = weekProgress(t, date, cm ?? new Map())
    if (wp.doneToday) return wp.done <= wp.need
    return wp.need - wp.done > wp.daysAfter
  }
  const days = t.days_of_week
  if (!days || days.length === 0 || days.length === 7) return true
  return days.includes(dow(date))
}

/** What to show on a given day: items to do, plus weekly items whose quota is already met. */
export function dayPlan(tasks: Task[], cm: CompletionMap, date: string): { due: Task[]; met: Task[] } {
  const due: Task[] = []
  const met: Task[] = []
  for (const t of tasks) {
    if (t.archived) continue
    if (isWeekly(t)) {
      if (date < t.start_date || (t.end_date && date > t.end_date)) continue
      const wp = weekProgress(t, date, cm)
      if (wp.doneToday || wp.done < wp.need) due.push(t)
      else met.push(t)
    } else if (isScheduled(t, date, cm)) due.push(t)
  }
  return { due, met }
}

export interface DayStat {
  date: string
  scheduled: number
  done: number
  rate: number // 0..1, 0 when nothing scheduled
  hasWork: boolean
}

export function daySeries(tasks: Task[], cs: Completion[], from: string, to: string): DayStat[] {
  const cm = completionMap(cs)
  return eachDay(from, to).map((date) => {
    let scheduled = 0
    let done = 0
    for (const t of tasks) {
      if (!isScheduled(t, date, cm)) continue
      scheduled++
      if (cm.has(t.id + '|' + date)) done++
    }
    return { date, scheduled, done, rate: scheduled ? done / scheduled : 0, hasWork: scheduled > 0 }
  })
}

/** 7-day rolling completion rate for each day in [from..to] (looks back 6 days before `from`). */
export function momentum(tasks: Task[], cs: Completion[], from: string, to: string): { date: string; rate: number | null; day: number | null }[] {
  if (from > to) return []
  const s = daySeries(tasks, cs, addDays(from, -6), to)
  return s.slice(6).map((d, i) => {
    const win = s.slice(i, i + 7)
    const sched = win.reduce((a, x) => a + x.scheduled, 0)
    const done = win.reduce((a, x) => a + x.done, 0)
    return { date: d.date, rate: sched ? done / sched : null, day: d.hasWork ? d.rate : null }
  })
}

export interface Summary {
  scheduled: number
  done: number
  rate: number
}

export function summarise(series: DayStat[]): Summary {
  let scheduled = 0
  let done = 0
  for (const d of series) {
    scheduled += d.scheduled
    done += d.done
  }
  return { scheduled, done, rate: scheduled ? done / scheduled : 0 }
}

/**
 * What-if for "today" within a period [from..to]:
 *  - doToday:   everything scheduled today is done
 *  - missToday: nothing more gets done today (already-done stays done)
 * Past days stay as they are. Future days (after today) are assumed completed
 * in `perfectFuture`, or at the current rate in `paceFuture`.
 */
export interface WhatIf {
  periodRateIfDo: number
  periodRateIfMiss: number
  periodRateIfPerfectFuture: number
  periodRateIfPaceFuture: number
  pendingToday: number
}

export function whatIf(tasks: Task[], cs: Completion[], from: string, to: string, todayStr: string): WhatIf {
  const series = daySeries(tasks, cs, from, to)
  let pastDone = 0, pastSched = 0
  let todaySched = 0, todayDone = 0
  let futureSched = 0
  for (const d of series) {
    if (d.date < todayStr) { pastDone += d.done; pastSched += d.scheduled }
    else if (d.date === todayStr) { todaySched = d.scheduled; todayDone = d.done }
    else futureSched += d.scheduled
  }
  const total = pastSched + todaySched + futureSched
  const rateOf = (done: number) => (total ? done / total : 0)
  const soFarSched = pastSched + todaySched
  const currentPace = soFarSched ? (pastDone + todayDone) / soFarSched : 0
  return {
    periodRateIfDo: rateOf(pastDone + todaySched),
    periodRateIfMiss: rateOf(pastDone + todayDone),
    periodRateIfPerfectFuture: rateOf(pastDone + todaySched + futureSched),
    periodRateIfPaceFuture: rateOf(pastDone + todayDone + futureSched * currentPace),
    pendingToday: todaySched - todayDone
  }
}

export interface Streak {
  current: number
  best: number
}

/** Streak over scheduled days only. Today pending does not break the current streak. */
export function streak(tasks: Task[], cs: Completion[], todayStr: string, lookbackFrom: string): Streak {
  const series = daySeries(tasks, cs, lookbackFrom, todayStr).filter((d) => d.hasWork)
  let best = 0, run = 0
  for (const d of series) {
    if (d.done === d.scheduled) { run++; best = Math.max(best, run) }
    else if (d.date === todayStr) { /* pending today: ignore */ }
    else run = 0
  }
  // current: walk backwards from the most recent day
  let current = 0
  for (let i = series.length - 1; i >= 0; i--) {
    const d = series[i]
    if (d.done === d.scheduled) current++
    else if (d.date === todayStr) continue
    else break
  }
  return { current, best }
}

export function tasksOfGoal(data: Data, goalId: string): Task[] {
  return data.tasks.filter((t) => t.goal_id === goalId && !t.archived)
}

export interface GoalPoint {
  date: string
  ideal: number
  actual: number | null
  projectedPace: number | null
  ifDoToday: number | null
  ifMissToday: number | null
}

export interface GoalReport {
  target: number
  progress: number
  start: string
  end: string
  points: GoalPoint[]
  /** expected final if every scheduled task is done from today on */
  bestFinal: number
  /** expected final if today's pending are missed but every future day is done */
  missTodayFinal: number
  /** expected final continuing at the average pace so far */
  paceFinal: number
  onTrack: boolean
  daysLeft: number
}

/**
 * Cumulative progress for a goal. Numeric goals add up every completion's value
 * (extra sessions above a weekly quota still count). Consistency goals count
 * completed scheduled occurrences against all scheduled occurrences.
 */
export function goalReport(data: Data, goal: Goal, todayStr: string): GoalReport | null {
  const tasks = tasksOfGoal(data, goal.id)
  if (tasks.length === 0) return null
  const start = goal.start_date
  const end = goal.end_date ?? addDays(todayStr, 90)
  const cm = completionMap(data.completions)
  const numeric = goal.kind === 'numeric'
  const potential = (t: Task) => (numeric ? t.amount : 1)
  const gain = (t: Task, d: string, sched: boolean) => {
    const c = cm.get(t.id + '|' + d)
    if (!c) return 0
    return numeric ? c.value : sched ? 1 : 0
  }

  const days = eachDay(start, end)
  let totalPotential = 0
  for (const d of days) for (const t of tasks) if (isScheduled(t, d, cm)) totalPotential += potential(t)
  const target = numeric && goal.target_value ? goal.target_value : totalPotential
  if (target <= 0) return null

  const totalDays = Math.max(1, days.length)
  let progress = 0
  let remainingSched = 0 // potential strictly after today
  let todayPending = 0
  for (const d of days) {
    for (const t of tasks) {
      const sched = isScheduled(t, d, cm)
      if (d <= todayStr) {
        progress += gain(t, d, sched)
        if (d === todayStr && sched && !cm.has(t.id + '|' + d)) todayPending += potential(t)
      } else if (sched) remainingSched += potential(t)
    }
  }
  // before the goal starts nothing is expected yet, and the full span is still ahead
  const elapsed = Math.max(0, Math.min(totalDays, diffDays(start, todayStr) + 1))
  const perDay = elapsed ? progress / elapsed : 0
  const daysLeft = todayStr < start ? totalDays : Math.max(0, diffDays(todayStr, end))
  const paceFinal = progress + perDay * daysLeft
  const missTodayFinal = progress + remainingSched
  const bestFinal = progress + todayPending + remainingSched

  const points: GoalPoint[] = []
  let cum = 0
  let futureCum = 0
  let baseAtToday = 0
  days.forEach((d, i) => {
    if (d <= todayStr) for (const t of tasks) cum += gain(t, d, isScheduled(t, d, cm))
    if (d === todayStr) baseAtToday = cum
    if (d > todayStr) for (const t of tasks) if (isScheduled(t, d, cm)) futureCum += potential(t)
    const fromToday = d >= todayStr
    points.push({
      date: d,
      ideal: (target * (i + 1)) / totalDays,
      actual: d <= todayStr ? cum : null,
      projectedPace: fromToday ? progress + perDay * diffDays(todayStr, d) : null,
      ifDoToday: fromToday ? baseAtToday + todayPending + futureCum : null,
      ifMissToday: fromToday ? baseAtToday + futureCum : null
    })
  })
  const idealToday = (target * elapsed) / totalDays
  return {
    target, progress, start, end, points,
    bestFinal, missTodayFinal, paceFinal,
    onTrack: progress >= idealToday - 1e-9,
    daysLeft
  }
}

/** whole percent that never rounds a partial result up to 100 */
export const pctNum = (x: number) => (x < 1 ? Math.min(99, Math.round(x * 100)) : Math.round(x * 100))
export const pct = (x: number) => `${pctNum(x)}%`
