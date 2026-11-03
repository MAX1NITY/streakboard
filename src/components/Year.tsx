import { useMemo, useState } from 'react'
import type { Data } from '../lib/types'
import { addDays, dow, endOfYear, longDate, startOfYear, today as todayFn } from '../lib/dates'
import { daySeries, pct, streak, summarise } from '../lib/stats'
import ScopePicker, { scopeLabel, scopeTasks, type Scope } from './ScopePicker'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function level(rate: number, has: boolean, future: boolean): string {
  if (future) return 'f'
  if (!has) return 'n'
  if (rate >= 1) return '4'
  if (rate >= 0.66) return '3'
  if (rate >= 0.33) return '2'
  if (rate > 0) return '1'
  return '0'
}

export default function Year({ data, scope, setScope }: { data: Data; scope: Scope; setScope: (s: Scope) => void }) {
  const real = todayFn()
  const [year, setYear] = useState(Number(real.slice(0, 4)))
  const from = startOfYear(`${year}-06-01`), to = endOfYear(`${year}-06-01`)
  const tasks = useMemo(() => scopeTasks(data, scope), [data, scope])
  const series = useMemo(() => daySeries(tasks, data.completions, from, to), [tasks, data.completions, from, to])
  const sum = summarise(series.filter((d) => d.date <= real))
  const st = useMemo(() => streak(tasks, data.completions, real, addDays(real, -730)), [tasks, data.completions, real])
  const perfectDays = series.filter((d) => d.hasWork && d.done === d.scheduled && d.date <= real).length
  const activeDays = series.filter((d) => d.hasWork && d.date <= real).length

  // columns = weeks starting Sunday
  const lead = dow(from)
  const cells: ({ date: string; lv: string; tip: string } | null)[] = Array(lead).fill(null)
  for (const d of series) {
    cells.push({ date: d.date, lv: level(d.rate, d.hasWork, d.date > real), tip: `${longDate(d.date)}: ${d.hasWork ? `${d.done}/${d.scheduled} done` : 'nothing scheduled'}` })
  }
  const weeks: (typeof cells)[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // label a column when its first day starts a new month (the partial first week counts once)
  let lastMonth = ''
  const monthLabels = weeks.map((wk) => {
    const m = wk.find(Boolean)?.date.slice(5, 7) ?? ''
    if (!m || m === lastMonth) return ''
    lastMonth = m
    return MONTHS[Number(m) - 1]
  })

  const monthRates = MONTHS.map((_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`
    const s = summarise(series.filter((d) => d.date.startsWith(key) && d.date <= real))
    return s.scheduled ? s.rate : null
  })

  return (
    <div className="stack">
      <div className="row gap wrap">
        <div className="row grow between">
          <button className="icon" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
          <div className="h">{year}</div>
          <button className="icon" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
        </div>
        <ScopePicker data={data} scope={scope} onChange={setScope} />
      </div>

      <div className="grid4">
        <div className="stat"><span>Year so far</span><b>{pct(sum.rate)}</b><small>{sum.done}/{sum.scheduled}</small></div>
        <div className="stat"><span>Perfect days</span><b>{perfectDays}</b><small>of {activeDays} active</small></div>
        <div className="stat"><span>Streak</span><b>🔥 {st.current}</b><small>best {st.best}</small></div>
        <div className="stat"><span>Showing</span><b className="small-b">{scopeLabel(data, scope)}</b><small>&nbsp;</small></div>
      </div>

      <div className="card">
        <div className="card-title">Every day of {year}</div>
        <div className="heat-wrap">
          <div className="heat-months">{monthLabels.map((m, i) => <span key={i}>{m}</span>)}</div>
          <div className="heat">
            {weeks.map((wk, i) => (
              <div className="heat-col" key={i}>
                {Array.from({ length: 7 }).map((_, j) => {
                  const c = wk[j]
                  return c ? <div key={j} className={'cell l' + c.lv} title={c.tip} /> : <div key={j} className="cell blank" />
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="legend">less <i className="cell l0" /><i className="cell l1" /><i className="cell l2" /><i className="cell l3" /><i className="cell l4" /> all done</div>
      </div>

      <div className="card">
        <div className="card-title">Month by month</div>
        <div className="months">
          {MONTHS.map((m, i) => (
            <div key={m} className="mcell">
              <div className="mbar"><div style={{ height: monthRates[i] === null ? '0%' : `${Math.max(4, monthRates[i]! * 100)}%` }} /></div>
              <span>{m}</span>
              <small>{monthRates[i] === null ? '–' : pct(monthRates[i]!)}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
