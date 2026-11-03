import { useMemo, useState } from 'react'
import type { Data, Task } from '../lib/types'
import { addDays, endOfMonth, longDate, startOfMonth, today as todayFn } from '../lib/dates'
import { completionMap, dayPlan, daySeries, isScheduled, isWeekly, pct, streak, summarise, weekProgress, whatIf } from '../lib/stats'
import { TaskForm } from './Forms'

interface Props {
  data: Data
  toggle: (t: Task, date: string) => void
  setAmount: (t: Task, date: string, value: number) => void
  save: (table: 'tasks', t: Task) => void
  del: (table: 'tasks', id: string) => void
}

function Ring({ value, label }: { value: number; label: string }) {
  const r = 46, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 120 120" className="ring" role="img" aria-label={`${label}: ${pct(value)}`}>
      <circle cx="60" cy="60" r={r} className="ring-bg" />
      <circle cx="60" cy="60" r={r} className="ring-fg" strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" className="ring-num">{pct(value)}</text>
      <text x="60" y="76" textAnchor="middle" className="ring-sub">{label}</text>
    </svg>
  )
}

function AmountModal({ task, unit, current, onSave, onClose }: { task: Task; unit: string; current: number; onSave: (v: number) => void; onClose: () => void }) {
  const [v, setV] = useState(String(current))
  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          const n = Number(v)
          if (Number.isFinite(n) && n >= 0) {
            onSave(n)
            onClose()
          }
        }}
      >
        <div className="row between">
          <h2>Log amount</h2>
          <button type="button" className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="muted small">{task.title}: how much did you actually do?</div>
        <div className="row">
          <input className="input" type="number" min="0" step="any" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
          <span className="muted">{unit}</span>
        </div>
        <p className="muted small">Saving marks the task as done for this day with this amount. The usual amount is {task.amount}.</p>
        <button className="btn primary">Save</button>
      </form>
    </div>
  )
}

export default function Today({ data, toggle, setAmount, save, del }: Props) {
  const real = todayFn()
  const [date, setDate] = useState(real)
  const [editing, setEditing] = useState<Task | null | 'new'>(null)
  const [logging, setLogging] = useState<{ task: Task; date: string } | null>(null)
  const cm = useMemo(() => completionMap(data.completions), [data.completions])
  const live = useMemo(() => data.tasks.filter((t) => !t.archived), [data.tasks])

  const { due, met } = useMemo(() => dayPlan(live, cm, date), [live, cm, date])
  // the ring only counts what is actually expected: weekly items join once done or once the day is "forced"
  const counted = due.filter((t) => isScheduled(t, date, cm))
  const done = counted.filter((t) => cm.has(t.id + '|' + date)).length
  const dayRate = counted.length ? done / counted.length : 0
  const optional = due.filter((t) => !counted.includes(t))

  const overdue = date === real
    ? live.filter((t) => t.type === 'oneoff' && (t.end_date ?? t.start_date) < real && !cm.has(t.id + '|' + (t.end_date ?? t.start_date)))
    : []

  const mFrom = startOfMonth(date), mTo = endOfMonth(date)
  const w = useMemo(() => whatIf(live, data.completions, mFrom, mTo, real), [live, data.completions, mFrom, mTo, real])
  const monthSoFar = summarise(daySeries(live, data.completions, mFrom, date > mTo ? mTo : date))
  const week = daySeries(live, data.completions, addDays(real, -6), real)

  const goalOf = (t: Task) => data.goals.find((g) => g.id === t.goal_id)

  function Row({ t, late, muted }: { t: Task; late?: boolean; muted?: boolean }) {
    const rowDate = late ? (t.end_date ?? t.start_date) : date
    const comp = cm.get(t.id + '|' + rowDate)
    const isDone = Boolean(comp)
    const s = t.type === 'recurring' ? streak([t], data.completions, real, t.start_date < addDays(real, -400) ? addDays(real, -400) : t.start_date) : null
    const g = goalOf(t)
    const numeric = g?.kind === 'numeric'
    const wp = isWeekly(t) ? weekProgress(t, rowDate, cm) : null
    return (
      <li className={'task' + (isDone || muted ? ' done' : '')}>
        <button className={'check' + (isDone ? ' on' : '')} onClick={() => toggle(t, rowDate)} aria-pressed={isDone} aria-label={`${isDone ? 'Unmark' : 'Mark'} ${t.title}`}>
          {isDone ? '✓' : ''}
        </button>
        <div className="grow" onClick={() => setEditing(t)}>
          <div className="title">{t.title}</div>
          <div className="meta">
            {late && <span className="tag warn">overdue</span>}
            {wp && <span className="tag">{wp.done}/{wp.need} this week</span>}
            {g && <span className="tag" style={{ borderColor: g.color, color: g.color }}>{g.title}</span>}
            {numeric && <span className="tag">{isDone ? comp!.value : t.amount}{g!.unit ? ' ' + g!.unit : ''}</span>}
            {s && s.current > 0 && <span className="tag fire">🔥 {s.current}</span>}
          </div>
        </div>
        {numeric && (
          <button className="icon small-i" onClick={() => setLogging({ task: t, date: rowDate })} aria-label={`Log amount for ${t.title}`} title="Log a different amount">±</button>
        )}
      </li>
    )
  }

  return (
    <div className="stack">
      <div className="row between">
        <button className="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <div className="center">
          <div className="h">{date === real ? 'Today' : longDate(date)}</div>
          {date === real && <div className="muted small">{longDate(date)}</div>}
        </div>
        <button className="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
      </div>
      {date !== real && <button className="link center" onClick={() => setDate(real)}>Jump to today</button>}

      <div className="card hero">
        <Ring value={dayRate} label={`${done}/${counted.length} done`} />
        <div className="grow stack tight">
          <div className="muted small">This week</div>
          <div className="spark" aria-hidden>
            {week.map((d) => (
              <div key={d.date} className="spark-col" title={`${d.date}: ${d.done}/${d.scheduled}`}>
                <div className="spark-bar"><div style={{ height: `${d.hasWork ? Math.max(6, d.rate * 100) : 0}%` }} className={d.date === real ? 'now' : ''} /></div>
                <span>{new Date(d.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <div className="muted small">Month so far: <b>{pct(monthSoFar.rate)}</b> ({monthSoFar.done}/{monthSoFar.scheduled})</div>
        </div>
      </div>

      {date === real && w.pendingToday > 0 && (
        <div className="card whatif">
          <div className="small muted">What today does to your month</div>
          <div className="grid2 gap">
            <div className="pill good"><span>Finish today</span><b>{pct(w.periodRateIfDo)}</b></div>
            <div className="pill bad"><span>Miss today</span><b>{pct(w.periodRateIfMiss)}</b></div>
          </div>
          <div className="small muted">If you then hit everything for the rest of the month: {pct(w.periodRateIfPerfectFuture)} at best.</div>
        </div>
      )}
      {date === real && w.pendingToday === 0 && counted.length > 0 && (
        <div className="card whatif good-card">Everything required today is done. Your month is on <b>{pct(w.periodRateIfDo)}</b>.</div>
      )}

      {overdue.length > 0 && (
        <>
          <div className="section">Overdue</div>
          <ul className="list">{overdue.map((t) => <Row key={t.id} t={t} late />)}</ul>
        </>
      )}

      <div className="section row between">
        <span>{date === real ? 'Today' : 'This day'}</span>
        <button className="btn small-btn" onClick={() => setEditing('new')}>+ Task</button>
      </div>
      {counted.length === 0 && optional.length === 0 ? (
        <div className="empty card">
          {live.length === 0 ? 'No tasks yet. Add your first one, then watch the graphs fill up.' : 'Nothing scheduled for this day.'}
        </div>
      ) : (
        <>
          {counted.length > 0 && <ul className="list">{counted.map((t) => <Row key={t.id} t={t} />)}</ul>}
          {optional.length > 0 && (
            <>
              <div className="section">Weekly goals, flexible days</div>
              <ul className="list">{optional.map((t) => <Row key={t.id} t={t} />)}</ul>
            </>
          )}
        </>
      )}

      {met.length > 0 && (
        <>
          <div className="section">Weekly target met 🎉</div>
          <ul className="list">{met.map((t) => <Row key={t.id} t={t} muted />)}</ul>
        </>
      )}

      {editing && (
        <TaskForm
          task={editing === 'new' ? undefined : editing}
          goals={data.goals}
          onSave={(t) => save('tasks', t)}
          onDelete={(id) => del('tasks', id)}
          onClose={() => setEditing(null)}
        />
      )}
      {logging && (
        <AmountModal
          task={logging.task}
          unit={goalOf(logging.task)?.unit ?? ''}
          current={cm.get(logging.task.id + '|' + logging.date)?.value ?? logging.task.amount}
          onSave={(v) => setAmount(logging.task, logging.date, v)}
          onClose={() => setLogging(null)}
        />
      )}
    </div>
  )
}
