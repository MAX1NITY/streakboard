import { daySeries, goalReport, isScheduled, momentum, pct, streak, summarise, whatIf } from './stats'
import type { Completion, Data, Goal, Task } from './types'

let fails = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}
const near = (name: string, got: number, want: number) => eq(name, Math.round(got * 1000) / 1000, want)

const mk = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, type: 'recurring', goal_id: null,
  days_of_week: [0, 1, 2, 3, 4, 5, 6], start_date: '2026-11-01', end_date: null, amount: 1, archived: false, ...over
})
const comp = (task: string, date: string, value = 1): Completion => ({ id: task + date, task_id: task, date, value })

// 2026-11-02 is a Monday
eq('weekday schedule', isScheduled(mk('a', { days_of_week: [1, 3] }), '2026-11-02'), true)
eq('weekday schedule off', isScheduled(mk('a', { days_of_week: [1, 3] }), '2026-11-03'), false)
eq('before start', isScheduled(mk('a'), '2026-10-31'), false)
eq('oneoff', isScheduled(mk('o', { type: 'oneoff', end_date: '2026-11-05' }), '2026-11-05'), true)

const t1 = mk('t1')
const cs = [comp('t1', '2026-11-01'), comp('t1', '2026-11-02'), comp('t1', '2026-11-04')]
const s = summarise(daySeries([t1], cs, '2026-11-01', '2026-11-04'))
eq('summary', [s.scheduled, s.done], [4, 3])

// streak: 1,2 done, 3 missed, 4 done, today = 4
const st = streak([t1], cs, '2026-11-04', '2026-11-01')
eq('streak current', st.current, 1)
eq('streak best', st.best, 2)

// pending today does not break streak
const st2 = streak([t1], [comp('t1', '2026-11-02'), comp('t1', '2026-11-03')], '2026-11-04', '2026-11-02')
eq('pending today keeps streak', st2.current, 2)

// what-if over Nov 1..Nov 10, today = Nov 4 (done 1,2,4 earlier; today 4 pending removed -> use 3 done up to 3)
const w = whatIf([t1], [comp('t1', '2026-11-01'), comp('t1', '2026-11-02'), comp('t1', '2026-11-03')], '2026-11-01', '2026-11-10', '2026-11-04')
near('if miss', w.periodRateIfMiss, 0.3)
near('if do', w.periodRateIfDo, 0.4)
near('perfect future', w.periodRateIfPerfectFuture, 1)
eq('pending today', w.pendingToday, 1)

// numeric goal: 100 km over Nov 1..Nov 10, 10 km per daily run; today Nov 4, done 3 days
const goal: Goal = { id: 'g', title: 'Run', kind: 'numeric', target_value: 100, unit: 'km', start_date: '2026-11-01', end_date: '2026-11-10', color: '#fff' }
const run = mk('run', { goal_id: 'g', amount: 10 })
const data: Data = { goals: [goal], tasks: [run], completions: ['01', '02', '03'].map((d) => comp('run', '2026-11-' + d, 10)) }
const r = goalReport(data, goal, '2026-11-04')!
eq('goal progress', r.progress, 30)
eq('goal target', r.target, 100)
eq('goal best final', r.bestFinal, 100)
eq('goal miss today final', r.missTodayFinal, 90)
near('goal pace final', r.paceFinal, 75) // 30 over 4 days = 7.5/day, 6 days left
eq('goal on track?', r.onTrack, false) // ideal after 4 days = 40, have 30

// weekly target: 3x a week, week of Mon 2026-11-02..Sun 2026-11-08, only Monday done
const wk = mk('w', { weekly_target: 3, start_date: '2026-10-01' })
const wcs = [comp('w', '2026-11-02')]
const wser = daySeries([wk], wcs, '2026-11-02', '2026-11-08')
eq('weekly: scheduled slots = quota', summarise(wser).scheduled, 3)
eq('weekly: done', summarise(wser).done, 1)
eq('weekly: Tue not forced yet', wser[1].scheduled, 0)
eq('weekly: Sat forced miss', wser[5].scheduled, 1)
// extra completions above the quota are not counted as scheduled
const wfull = [2, 3, 4, 5].map((d) => comp('w', '2026-11-0' + d))
eq('weekly: extras ignored', summarise(daySeries([wk], wfull, '2026-11-02', '2026-11-08')).scheduled, 3)
// task starting mid-week gets a pro-rated quota
const wmid = mk('m', { weekly_target: 5, start_date: '2026-11-07' })
eq('weekly: mid-week quota capped', summarise(daySeries([wmid], [], '2026-11-02', '2026-11-08')).scheduled, 2)

// momentum: daily task from Nov 1, done Nov 1,2,4 (3 missed)
const mo = momentum([t1], cs, '2026-11-01', '2026-11-04')
eq('momentum dates', mo.map((m) => m.date), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
eq('momentum ignores days before start', mo[0].rate, 1)
near('momentum rolling', mo[3].rate!, 0.75) // 3 of 4 scheduled in window
eq('momentum single day', mo[2].day, 0)
// window slides: after 7 days only the last 7 count
const t8 = mk('t8')
const mo8 = momentum([t8], [comp('t8', '2026-11-01')], '2026-11-08', '2026-11-08')
eq('momentum drops days outside window', mo8[0].rate, 0) // Nov 1 is outside Nov 2..8
eq('momentum empty range', momentum([t1], cs, '2026-11-05', '2026-11-04'), [])

// goal that has not started yet is not behind, and its whole span is still ahead
const later: Goal = { ...goal, id: 'g2', start_date: '2026-11-10', end_date: '2026-12-10' }
const r2 = goalReport({ goals: [later], tasks: [mk('run2', { goal_id: 'g2', amount: 10, start_date: '2026-11-10' })], completions: [] }, later, '2026-11-03')!
eq('goal before start on track', r2.onTrack, true)
eq('goal before start days left', r2.daysLeft, 31)

eq('pct never rounds partial up to 100', pct(216 / 217), '99%')
eq('pct full', pct(1), '100%')

if (fails) { console.error(`${fails} failed`); process.exit(1) }
console.log('all passed')
