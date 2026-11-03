import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Data } from '../lib/types'
import {
  addDays, endOfMonth, endOfYear, parse, shortDate, startOfMonth, startOfWeek, startOfYear, today as todayFn
} from '../lib/dates'
import { daySeries, pct, streak, summarise, whatIf } from '../lib/stats'
import ScopePicker, { scopeTasks, type Scope } from './ScopePicker'

type Range = 'week' | 'month' | 'year'

function period(range: Range, anchor: string): { from: string; to: string; label: string } {
  if (range === 'week') {
    const from = startOfWeek(anchor)
    const to = addDays(from, 6)
    return { from, to, label: `${shortDate(from)} – ${shortDate(to)}` }
  }
  if (range === 'month') {
    return { from: startOfMonth(anchor), to: endOfMonth(anchor), label: parse(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }
  }
  return { from: startOfYear(anchor), to: endOfYear(anchor), label: anchor.slice(0, 4) }
}

function shift(range: Range, anchor: string, dir: 1 | -1): string {
  const d = parse(anchor)
  if (range === 'week') return addDays(anchor, 7 * dir)
  if (range === 'month') d.setMonth(d.getMonth() + dir, 1)
  else d.setFullYear(d.getFullYear() + dir, 0, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const GREEN = '#5eeaaa', RED = '#ff7b9c', BLUE = '#6ea8ff', GREY = '#5b6384'

export default function Stats({ data, scope, setScope }: { data: Data; scope: Scope; setScope: (s: Scope) => void }) {
  const real = todayFn()
  const [range, setRange] = useState<Range>('month')
  const [anchor, setAnchor] = useState(real)
  const p = period(range, anchor)
  const tasks = useMemo(() => scopeTasks(data, scope), [data, scope])
  const series = useMemo(() => daySeries(tasks, data.completions, p.from, p.to), [tasks, data.completions, p.from, p.to])
  const sum = summarise(series.filter((d) => d.date <= real))
  const total = summarise(series)
  const includesToday = real >= p.from && real <= p.to
  const w = useMemo(() => whatIf(tasks, data.completions, p.from, p.to, real), [tasks, data.completions, p.from, p.to, real])
  const st = useMemo(() => streak(tasks, data.completions, real, addDays(real, -730)), [tasks, data.completions, real])

  // bars: days for week/month, months for year
  const bars = useMemo(() => {
    if (range !== 'year') {
      return series.map((d) => ({ name: range === 'week' ? parse(d.date).toLocaleDateString(undefined, { weekday: 'short' }) : String(parseInt(d.date.slice(8), 10)), rate: d.hasWork ? Math.round(d.rate * 100) : null, date: d.date, future: d.date > real, done: d.done, sched: d.scheduled }))
    }
    const out: { name: string; rate: number | null; date: string; future: boolean; done: number; sched: number }[] = []
    for (let m = 0; m < 12; m++) {
      const key = `${anchor.slice(0, 4)}-${String(m + 1).padStart(2, '0')}`
      const days = series.filter((d) => d.date.startsWith(key))
      const s = summarise(days)
      out.push({ name: new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'short' }), rate: s.scheduled ? Math.round(s.rate * 100) : null, date: key + '-01', future: key + '-01' > real, done: s.done, sched: s.scheduled })
    }
    return out
  }, [series, range, anchor, real])

  // cumulative done vs possible, with what-if lines from today
  const cum = useMemo(() => {
    let possible = 0, actual = 0, perfect = 0, miss = 0
    return series.map((d) => {
      possible += d.scheduled
      const past = d.date <= real
      if (past) actual += d.done
      if (d.date === real) { perfect = actual + (d.scheduled - d.done); miss = actual }
      if (d.date > real) { perfect += d.scheduled; miss += d.scheduled }
      return {
        date: d.date,
        possible,
        actual: past ? actual : null,
        ifDo: d.date >= real ? perfect : null,
        ifMiss: d.date >= real ? miss : null
      }
    })
  }, [series, real])

  const perTask = useMemo(() => tasks.map((t) => {
    const s = summarise(daySeries([t], data.completions, p.from, p.to < real ? p.to : real))
    return { t, ...s }
  }).filter((x) => x.scheduled > 0).sort((a, b) => b.rate - a.rate), [tasks, data.completions, p.from, p.to, real, series])

  const tickEvery = range === 'year' ? 30 : range === 'month' ? 4 : 0
  const empty = total.scheduled === 0

  return (
    <div className="stack">
      <div className="row gap wrap">
        <div className="seg grow">
          {(['week', 'month', 'year'] as Range[]).map((r) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r[0].toUpperCase() + r.slice(1)}</button>
          ))}
        </div>
        <ScopePicker data={data} scope={scope} onChange={setScope} />
      </div>

      <div className="row between">
        <button className="icon" onClick={() => setAnchor(shift(range, anchor, -1))} aria-label="Previous period">‹</button>
        <div className="center"><div className="h">{p.label}</div></div>
        <button className="icon" onClick={() => setAnchor(shift(range, anchor, 1))} aria-label="Next period">›</button>
      </div>

      {empty ? (
        <div className="card empty">Nothing scheduled in this period for this selection.</div>
      ) : (
        <>
          <div className="grid4">
            <div className="stat"><span>Completion</span><b>{pct(sum.rate)}</b><small>{sum.done}/{sum.scheduled} so far</small></div>
            <div className="stat"><span>Streak</span><b>🔥 {st.current}</b><small>best {st.best}</small></div>
            <div className="stat"><span>Left to do</span><b>{total.scheduled - sum.scheduled}</b><small>scheduled ahead</small></div>
            <div className="stat"><span>Period max</span><b>{pct(w.periodRateIfPerfectFuture)}</b><small>if perfect from now</small></div>
          </div>

          {includesToday && w.pendingToday > 0 && (
            <div className="card whatif">
              <div className="small muted">What today does to this {range}</div>
              <div className="grid2 gap">
                <div className="pill good"><span>Finish today</span><b>{pct(w.periodRateIfDo)}</b></div>
                <div className="pill bad"><span>Miss today</span><b>{pct(w.periodRateIfMiss)}</b></div>
              </div>
              <div className="small muted">At your current pace you'd finish around {pct(w.periodRateIfPaceFuture)}.</div>
            </div>
          )}

          <div className="card">
            <div className="card-title">{range === 'year' ? 'Consistency by month' : 'Consistency by day'}</div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bars} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#262b45" vertical={false} />
                  <XAxis dataKey="name" stroke={GREY} tickLine={false} axisLine={false} interval={range === 'month' ? 2 : 0} fontSize={11} />
                  <YAxis stroke={GREY} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 50, 100]} unit="%" fontSize={11} />
                  <Tooltip cursor={{ fill: '#ffffff10' }} contentStyle={{ background: '#161a2e', border: '1px solid #2c3254', borderRadius: 10 }} formatter={(v: number | string, _n, item) => [`${v}% (${(item.payload as any).done}/${(item.payload as any).sched})`, 'Done']} labelFormatter={(_l, pl) => (pl && pl[0] ? shortDate((pl[0].payload as any).date) : '')} />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {bars.map((b, i) => <Cell key={i} fill={b.future ? '#2c3254' : (b.rate ?? 0) >= 100 ? GREEN : (b.rate ?? 0) >= 50 ? BLUE : RED} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend"><i style={{ background: GREEN }} />all done <i style={{ background: BLUE }} />50%+ <i style={{ background: RED }} />under 50% <i style={{ background: '#2c3254' }} />upcoming</div>
          </div>

          <div className="card">
            <div className="card-title">Done vs possible, and where you're heading</div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={cum} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#262b45" vertical={false} />
                  <XAxis dataKey="date" stroke={GREY} tickLine={false} axisLine={false} interval={tickEvery || 'preserveStartEnd'} tickFormatter={(d: string) => shortDate(d)} fontSize={11} />
                  <YAxis stroke={GREY} tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#161a2e', border: '1px solid #2c3254', borderRadius: 10 }} labelFormatter={(d: string) => shortDate(d)} />
                  {includesToday && <ReferenceLine x={real} stroke={GREY} strokeDasharray="3 3" />}
                  <Line type="monotone" dataKey="possible" name="Everything scheduled" stroke={GREY} dot={false} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="actual" name="Done" stroke={GREEN} dot={false} strokeWidth={3} />
                  <Line type="monotone" dataKey="ifDo" name="If you finish today, then all" stroke={GREEN} strokeDasharray="5 4" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ifMiss" name="If you miss today, then all" stroke={RED} strokeDasharray="5 4" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="legend"><i style={{ background: GREEN }} />done <i style={{ background: GREY }} />everything scheduled <i style={{ background: RED }} />miss-today path</div>
          </div>

          {scope.kind !== 'task' && perTask.length > 1 && (
            <div className="card">
              <div className="card-title">By task</div>
              <ul className="bars">
                {perTask.map(({ t, rate, done, scheduled }) => (
                  <li key={t.id}>
                    <div className="row between small"><span>{t.title}</span><span className="muted">{done}/{scheduled} · {pct(rate)}</span></div>
                    <div className="track"><div style={{ width: pct(rate) }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
