import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Completion, Task } from '../lib/types'
import { addDays, shortDate } from '../lib/dates'
import { daySeries } from '../lib/stats'

export const C = { mint: '#5eeaaa', sky: '#7aa8ff', ember: '#ffa25e', rose: '#ff7b9c', axis: '#6b7299', future: '#2a2f4d' }

export const axis = { stroke: C.axis, tickLine: false, axisLine: false, fontSize: 11 } as const

// one tooltip look for every chart
export function ChartTip({ active, payload, label, fmt, val }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <div className="tip-h">{fmt ? fmt(label, payload) : label}</div>
      {payload.filter((p: any) => p.value != null).map((p: any) => (
        <div key={p.dataKey} className="tip-r"><i style={{ background: String(p.color || p.stroke).startsWith('url') ? C.mint : p.color || p.stroke }} />{p.name}<b>{val ? val(p.value) : p.value}{p.unit ?? ''}</b></div>
      ))}
    </div>
  )
}

// smooth 7-day rolling completion rate: shows momentum instead of day-to-day noise
export function MomentumCurve({ tasks, completions, end, days = 30, height = 180 }: { tasks: Task[]; completions: Completion[]; end: string; days?: number; height?: number }) {
  const pts = useMemo(() => {
    const s = daySeries(tasks, completions, addDays(end, -(days + 6)), end)
    return s.slice(6).map((d, i) => {
      const win = s.slice(i, i + 7)
      const sched = win.reduce((a, x) => a + x.scheduled, 0)
      const done = win.reduce((a, x) => a + x.done, 0)
      return { date: d.date, rate: sched ? Math.round((done / sched) * 100) : null, day: d.hasWork ? Math.round(d.rate * 100) : null }
    })
  }, [tasks, completions, end, days])

  if (!pts.some((p) => p.rate != null)) return <div className="empty">Your curve appears once you've had a few scheduled days.</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={pts} margin={{ top: 10, right: 6, left: -26, bottom: 0 }}>
        <defs>
          <linearGradient id="mom-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.mint} stopOpacity={0.45} />
            <stop offset="100%" stopColor={C.mint} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="mom-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.sky} />
            <stop offset="100%" stopColor={C.mint} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" {...axis} interval="preserveStartEnd" minTickGap={40} tickFormatter={(d: string) => shortDate(d)} />
        <YAxis {...axis} domain={[0, 100]} ticks={[0, 50, 100]} unit="%" />
        <Tooltip cursor={{ stroke: '#ffffff30' }} content={<ChartTip fmt={(d: string) => shortDate(d)} />} />
        <Area type="natural" dataKey="day" name="That day" unit="%" stroke="none" fill="none" dot={{ r: 2, fill: '#ffffff40', stroke: 'none' }} activeDot={false} connectNulls />
        <Area type="natural" dataKey="rate" name="7-day average" unit="%" stroke="url(#mom-line)" strokeWidth={3} fill="url(#mom-fill)" connectNulls activeDot={{ r: 5, fill: C.mint, stroke: '#0d0f1c', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
