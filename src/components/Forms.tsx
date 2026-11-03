import { useState } from 'react'
import type { Goal, GoalKind, Task, TaskType } from '../lib/types'
import { today, uid } from '../lib/dates'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const COLORS = ['#5eeaaa', '#6ea8ff', '#ffb86b', '#ff7b9c', '#c792ff', '#f3e35b']

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function TaskForm({ task, goals, defaultGoalId, onSave, onDelete, onClose }: {
  task?: Task
  goals: Goal[]
  defaultGoalId?: string | null
  onSave: (t: Task) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [type, setType] = useState<TaskType>(task?.type ?? 'recurring')
  const [days, setDays] = useState<number[]>(task?.days_of_week?.length ? task.days_of_week : [0, 1, 2, 3, 4, 5, 6])
  const [mode, setMode] = useState<'days' | 'weekly'>(task?.weekly_target ? 'weekly' : 'days')
  const [weekly, setWeekly] = useState(String(task?.weekly_target ?? 3))
  const [start, setStart] = useState(task?.start_date ?? today())
  const [end, setEnd] = useState(task?.end_date ?? '')
  const [goalId, setGoalId] = useState(task?.goal_id ?? defaultGoalId ?? '')
  const [amount, setAmount] = useState(String(task?.amount ?? 1))

  const goal = goals.find((g) => g.id === goalId)
  const toggleDay = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (type === 'recurring' && mode === 'days' && days.length === 0) return
    const n = Number(amount)
    onSave({
      id: task?.id ?? uid(),
      title: title.trim(),
      type,
      goal_id: goalId || null,
      days_of_week: type === 'recurring' && mode === 'days' ? days : [0, 1, 2, 3, 4, 5, 6],
      weekly_target: type === 'recurring' && mode === 'weekly' ? Math.min(7, Math.max(1, Math.round(Number(weekly) || 1))) : null,
      start_date: type === 'oneoff' ? (end || start) : start,
      end_date: end || null,
      amount: Number.isFinite(n) && n > 0 ? n : 1,
      archived: task?.archived ?? false
    })
    onClose()
  }

  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input className="input" autoFocus placeholder="e.g. Run, Study 1 hour, Apply to 3 jobs" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="seg">
          <button type="button" className={type === 'recurring' ? 'on' : ''} onClick={() => setType('recurring')}>Repeats</button>
          <button type="button" className={type === 'oneoff' ? 'on' : ''} onClick={() => setType('oneoff')}>One-off</button>
        </div>
        {type === 'recurring' ? (
          <>
            <div className="seg">
              <button type="button" className={mode === 'days' ? 'on' : ''} onClick={() => setMode('days')}>Specific days</button>
              <button type="button" className={mode === 'weekly' ? 'on' : ''} onClick={() => setMode('weekly')}>X times a week</button>
            </div>
            {mode === 'days' ? (
              <div className="chips">
                {DAYS.map((n, i) => (
                  <button type="button" key={n} className={'chip' + (days.includes(i) ? ' on' : '')} onClick={() => toggleDay(i)}>{n}</button>
                ))}
              </div>
            ) : (
              <div>
                <label className="label">Times per week (any days, Mon to Sun)</label>
                <select className="select" value={weekly} onChange={(e) => setWeekly(e.target.value)}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}x a week</option>)}
                </select>
                <p className="muted small">A missed day only counts against you once there aren't enough days left in the week to hit this number.</p>
              </div>
            )}
            <div className="grid2">
              <div><label className="label">Starts</label><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><label className="label">Ends (optional)</label><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <p className="muted small">Leave "Ends" empty for something you'll do indefinitely.</p>
          </>
        ) : (
          <div>
            <label className="label">Due date</label>
            <input className="input" type="date" value={end || start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label">Part of a goal (optional)</label>
          <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
        {goal?.kind === 'numeric' && (
          <div>
            <label className="label">Each time I complete this, it adds ({goal.unit || 'units'})</label>
            <input className="input" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
        <div className="row between">
          {task && onDelete ? (
            <button type="button" className="btn danger" onClick={() => { if (confirm('Delete this task and its history?')) { onDelete(task.id); onClose() } }}>Delete</button>
          ) : <span />}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}

export function GoalForm({ goal, onSave, onDelete, onClose }: {
  goal?: Goal
  onSave: (g: Goal) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'numeric')
  const [target, setTarget] = useState(String(goal?.target_value ?? ''))
  const [unit, setUnit] = useState(goal?.unit ?? '')
  const [start, setStart] = useState(goal?.start_date ?? today())
  const [end, setEnd] = useState(goal?.end_date ?? `${new Date().getFullYear()}-12-31`)
  const [color, setColor] = useState(goal?.color ?? COLORS[0])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !end) return
    const t = Number(target)
    if (kind === 'numeric' && !(t > 0)) return
    onSave({
      id: goal?.id ?? uid(),
      title: title.trim(),
      kind,
      target_value: kind === 'numeric' ? t : null,
      unit: kind === 'numeric' ? unit.trim() || null : null,
      start_date: start,
      end_date: end,
      color
    })
    onClose()
  }

  return (
    <Modal title={goal ? 'Edit goal' : 'New goal'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input className="input" autoFocus placeholder="e.g. Run 100 km, Finish the course" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="seg">
          <button type="button" className={kind === 'numeric' ? 'on' : ''} onClick={() => setKind('numeric')}>Reach a number</button>
          <button type="button" className={kind === 'deadline' ? 'on' : ''} onClick={() => setKind('deadline')}>Do it consistently</button>
        </div>
        {kind === 'numeric' ? (
          <div className="grid2">
            <div><label className="label">Target</label><input className="input" type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="100" /></div>
            <div><label className="label">Unit</label><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="km, pages, hours" /></div>
          </div>
        ) : (
          <p className="muted small">Progress is every scheduled task in this goal completed by the end date.</p>
        )}
        <div className="grid2">
          <div><label className="label">Start</label><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="label">Deadline</label><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="chips">
          {COLORS.map((c) => (
            <button type="button" key={c} aria-label={`Colour ${c}`} className={'swatch' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="row between">
          {goal && onDelete ? (
            <button type="button" className="btn danger" onClick={() => { if (confirm('Delete this goal? Its tasks stay, just unlinked.')) { onDelete(goal.id); onClose() } }}>Delete</button>
          ) : <span />}
          <button className="btn primary">Save</button>
        </div>
      </form>
    </Modal>
  )
}
