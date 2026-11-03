export type GoalKind = 'deadline' | 'numeric'
export type TaskType = 'recurring' | 'oneoff'

export interface Goal {
  id: string
  title: string
  kind: GoalKind
  /** numeric goals: total to reach (e.g. 100). deadline goals: ignored (target = scheduled occurrences) */
  target_value: number | null
  unit: string | null
  start_date: string // YYYY-MM-DD
  end_date: string | null
  color: string
}

export interface Task {
  id: string
  title: string
  type: TaskType
  goal_id: string | null
  /** recurring: weekdays it applies to, 0=Sun..6=Sat. Empty/all 7 = every day */
  days_of_week: number[]
  /** recurring: first day it applies */
  start_date: string
  /** recurring: optional last day. oneoff: the due date */
  end_date: string | null
  /** recurring only: "N times a week, any days" (Mon-Sun weeks). When set, days_of_week is ignored */
  weekly_target?: number | null
  /** how much one completion adds to a numeric goal (e.g. 5 km) */
  amount: number
  archived: boolean
}

export interface Completion {
  id: string
  task_id: string
  date: string
  value: number
}

export interface Data {
  goals: Goal[]
  tasks: Task[]
  completions: Completion[]
}
