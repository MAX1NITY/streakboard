import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Data, Goal, Task } from '../lib/types'
import { shortDate, today as todayFn } from '../lib/dates'
import { goalReport, pct, tasksOfGoal } from '../lib/stats'
import { GoalForm, TaskForm } from './Forms'
import { C, ChartTip, axis } from './Charts'

interface Props {
  data: Data
  save: (table: 'goals' | 'tasks', row: Goal | Task) => void
  del: (table: 'goals' | 'tasks', id: string) => void
}

const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString()

function GoalCard({ goal, data, onEdit, onAddTask }: { goal: Goal; data: Data; onEdit: () => void; onAddTask: () => void }) {
  const real = todayFn()
  const r = useMemo(() => goalReport(data, goal, real), [data, goal, real])
  const unit = goal.kind === 'numeric' ? goal.unit ?? '' : 'completions'
  const tasks = tasksOfGoal(data, goal.id)
  const fraction = r ? Math.min(1, r.progress / r.target) : 0
  const reachable = r ? r.bestFinal >= r.target - 1e-9 : false

  return (
    <div className="card goal" style={{ borderTopColor: goal.color }}>
      <div className="row between">
        <div>
          <div className="h left">{goal.title}</div>
          <div className="muted small">
            {goal.kind === 'numeric' ? `${num(goal.target_value ?? 0)} ${goal.unit ?? ''}` : 'Consistency goal'} · {shortDate(goal.start_date)} → {goal.end_date ? shortDate(goal.end_date) : 'open'}
          </div>
        </div>
        <button className="icon" onClick={onEdit} aria-label={`Edit ${goal.title}`}>✎</button>
      </div>

      {!r ? (
        <div className="empty">{tasks.length === 0 ? 'Add a task to this goal so progress can be tracked.' : 'Nothing scheduled in this goal’s date range.'}</div>
      ) : (
        <>
          <div className="row between small">
            <span><b>{num(r.progress)}</b> / {num(r.target)} {unit}</span>
            <span className={r.onTrack ? 'good-t' : 'bad-t'}>{r.onTrack ? 'On track' : 'Behind pace'} · {r.daysLeft}d left</span>
          </div>
          <div className="track big"><div style={{ width: pct(fraction), background: goal.color }} /></div>

          <div className="chart">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={r.points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#ffffff0d" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="date" {...axis} interval="preserveStartEnd" tickFormatter={(d: string) => shortDate(d)} minTickGap={30} />
                <YAxis {...axis} />
                <Tooltip cursor={{ stroke: '#ffffff30' }} content={<ChartTip fmt={(d: string) => shortDate(d)} val={num} />} />
                <ReferenceLine x={real} stroke="#ffffff40" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="ideal" name="Needed pace" stroke={C.axis} dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="actual" name="Actual" stroke={goal.color} dot={false} strokeWidth={3} />
                <Line dataKey="projectedPace" name="At your pace" stroke={C.sky} strokeDasharray="2 4" dot={false} strokeWidth={2} />
                <Line dataKey="ifDoToday" name="Finish today, then all" stroke={C.mint} strokeDasharray="5 4" dot={false} strokeWidth={2} />
                <Line dataKey="ifMissToday" name="Miss today, then all" stroke={C.rose} strokeDasharray="5 4" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid2 gap">
            <div className="pill good"><span>Finish today → end at</span><b>{num(r.bestFinal)} {unit}</b></div>
            <div className="pill bad"><span>Miss today → end at</span><b>{num(r.missTodayFinal)} {unit}</b></div>
          </div>
          <div className="small muted">
            {reachable ? 'Target is still reachable if you do everything scheduled from now.' : 'Even doing everything scheduled from now, this falls short. Add more tasks or days, or adjust the target or deadline.'}
            {' '}At your current pace you'd end around <b>{num(r.paceFinal)} {unit}</b>.
          </div>
        </>
      )}

      <div className="row between">
        <div className="small muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} feeding this goal</div>
        <button className="btn small-btn" onClick={onAddTask}>+ Task for goal</button>
      </div>
    </div>
  )
}

export default function Goals({ data, save, del }: Props) {
  const [goalForm, setGoalForm] = useState<Goal | 'new' | null>(null)
  const [taskForm, setTaskForm] = useState<{ task?: Task; goalId?: string } | null>(null)
  const loose = data.tasks.filter((t) => !t.goal_id)

  return (
    <div className="stack">
      <div className="row between">
        <div className="h left">Goals</div>
        <button className="btn primary small-btn" onClick={() => setGoalForm('new')}>+ Goal</button>
      </div>

      {data.goals.length === 0 && <div className="card empty">Goals turn daily tasks into a destination: “Run 100 km by Dec 31”, “Study 40 hours”. Add one and link tasks to it.</div>}
      {data.goals.map((g) => (
        <GoalCard key={g.id} goal={g} data={data} onEdit={() => setGoalForm(g)} onAddTask={() => setTaskForm({ goalId: g.id })} />
      ))}

      <div className="section">All tasks</div>
      {data.tasks.length === 0 ? <div className="card empty">No tasks yet.</div> : (
        <ul className="list">
          {data.tasks.map((t) => {
            const g = data.goals.find((x) => x.id === t.goal_id)
            return (
              <li key={t.id} className={'task' + (t.archived ? ' done' : '')}>
                <div className="grow" onClick={() => setTaskForm({ task: t })}>
                  <div className="title">{t.title}{t.archived && ' (archived)'}</div>
                  <div className="meta">
                    <span className="tag">{t.type === 'oneoff' ? 'one-off' : t.weekly_target ? t.weekly_target + 'x/week, any days' : t.days_of_week.length === 7 ? 'daily' : t.days_of_week.length + 'x/week'}</span>
                    {g && <span className="tag" style={{ borderColor: g.color, color: g.color }}>{g.title}</span>}
                  </div>
                </div>
                <button className="btn small-btn" onClick={() => save('tasks', { ...t, archived: !t.archived })}>{t.archived ? 'Restore' : 'Archive'}</button>
              </li>
            )
          })}
        </ul>
      )}
      {loose.length > 0 && <div className="muted small">Tasks without a goal still count in your daily, monthly and yearly stats.</div>}

      {goalForm && (
        <GoalForm goal={goalForm === 'new' ? undefined : goalForm} onSave={(g) => save('goals', g)} onDelete={(id) => del('goals', id)} onClose={() => setGoalForm(null)} />
      )}
      {taskForm && (
        <TaskForm task={taskForm.task} goals={data.goals} defaultGoalId={taskForm.goalId} onSave={(t) => save('tasks', t)} onDelete={(id) => del('tasks', id)} onClose={() => setTaskForm(null)} />
      )}
    </div>
  )
}
