export const TASK_STATUSES = ['todo', 'in_progress', 'done']

export function nextTaskStatus(current) {
  const i = TASK_STATUSES.indexOf(current)
  if (i === -1) return 'todo'
  return TASK_STATUSES[(i + 1) % TASK_STATUSES.length]
}

export function statusLabel(status) {
  switch (status) {
    case 'todo': return 'To Do'
    case 'in_progress': return 'In Progress'
    case 'done': return 'Done'
    default: return status
  }
}

export function statusBadgeClasses(status) {
  switch (status) {
    case 'todo':
      return 'bg-slate-100 text-slate-700'
    case 'in_progress':
      return 'bg-amber-100 text-amber-800'
    case 'done':
      return 'bg-emerald-100 text-emerald-800'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}
