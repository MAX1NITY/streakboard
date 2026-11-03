import type { Data, Task } from '../lib/types'

export type Scope = { kind: 'all' } | { kind: 'goal'; id: string } | { kind: 'task'; id: string }

export const scopeKey = (s: Scope) => (s.kind === 'all' ? 'all' : `${s.kind}:${s.id}`)

export function parseScope(v: string): Scope {
  if (v === 'all') return { kind: 'all' }
  const [kind, id] = v.split(':')
  return { kind: kind as 'goal' | 'task', id }
}

export function scopeTasks(data: Data, s: Scope): Task[] {
  const live = data.tasks.filter((t) => !t.archived)
  if (s.kind === 'all') return live
  if (s.kind === 'goal') return live.filter((t) => t.goal_id === s.id)
  return live.filter((t) => t.id === s.id)
}

export function scopeLabel(data: Data, s: Scope): string {
  if (s.kind === 'all') return 'Everything'
  if (s.kind === 'goal') return data.goals.find((g) => g.id === s.id)?.title ?? 'Goal'
  return data.tasks.find((t) => t.id === s.id)?.title ?? 'Task'
}

export default function ScopePicker({ data, scope, onChange }: { data: Data; scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <select className="select" value={scopeKey(scope)} onChange={(e) => onChange(parseScope(e.target.value))} aria-label="Stats scope">
      <option value="all">Everything</option>
      {data.goals.length > 0 && (
        <optgroup label="Goals">
          {data.goals.map((g) => (
            <option key={g.id} value={`goal:${g.id}`}>{g.title}</option>
          ))}
        </optgroup>
      )}
      {data.tasks.filter((t) => !t.archived).length > 0 && (
        <optgroup label="Tasks">
          {data.tasks.filter((t) => !t.archived).map((t) => (
            <option key={t.id} value={`task:${t.id}`}>{t.title}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}
