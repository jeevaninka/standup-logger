import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from '../../components/Spinner.jsx'
import { TaskStatusBadge } from '../../components/TaskStatusBadge.jsx'
import { IconLink, IconExternalLink } from '../../components/icons/index.jsx'

function TaskCycleButton({ status, onClick }) {
  const map = {
    todo: { icon: null, cls: 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50' },
    in_progress: { icon: '–', cls: 'border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-600' },
    done: { icon: '✓', cls: 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-700' },
  }
  const { icon, cls } = map[status] ?? map.todo
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm font-bold transition-colors ${cls}`}
      aria-label={`Status: ${status}. Click to advance.`}
    >
      {icon}
    </button>
  )
}

export function MyTasksCard({
  loading,
  tasks,
  onAddTask,
  onCycleTaskStatus
}) {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [taskAdding, setTaskAdding] = useState(false)

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const totalCount = tasks.length

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    setTaskAdding(true)
    await onAddTask(newTaskTitle.trim())
    setNewTaskTitle('')
    setTaskAdding(false)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="h-5 w-36 rounded-lg bg-slate-200" />
        <div className="h-10 w-full rounded-xl bg-slate-100" />
        <div className="h-12 w-full rounded-xl bg-slate-100" />
        <div className="h-12 w-full rounded-xl bg-slate-100" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition ring-1 ring-black/[0.02]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-white px-6 py-5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Today's Tasks</h3>
          {totalCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: doneCount === totalCount ? '#10b981' : '#94a3b8' }}
              />
              {doneCount}/{totalCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-6">
        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(doneCount / totalCount) * 100}%` }}
            />
          </div>
        )}

        {/* Add task */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task…"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
          <button
            type="submit"
            disabled={taskAdding || !newTaskTitle.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            aria-label="Add task"
          >
            {taskAdding ? <Spinner className="h-4 w-4 text-white" /> : <span className="text-xl leading-none font-light">+</span>}
          </button>
        </form>

        {/* Task list */}
        <ul className="mt-3 divide-y divide-slate-50">
          {tasks.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-400">No tasks yet. Add one above.</li>
          ) : (
            tasks.map((task) => {
              const isBlockerTask = Boolean(task.blocker_source_id)
              return (
                <li
                  key={task.id}
                  className={`flex items-start gap-3 py-3 ${isBlockerTask ? 'rounded-xl px-2 ring-1 ring-amber-200 bg-amber-50/60 my-1' : ''}`}
                >
                  <TaskCycleButton status={task.status} onClick={() => onCycleTaskStatus(task)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm leading-snug ${
                          task.status === 'done'
                            ? 'text-slate-400 line-through'
                            : task.status === 'in_progress'
                              ? 'font-medium text-slate-900'
                              : 'text-slate-700'
                        }`}
                      >
                        {task.title}
                      </span>
                      <Link to={`/dashboard/tasks#task-${task.id}`} className="text-slate-400 hover:text-blue-600 transition-colors" title="Open in Tasks">
                        <IconExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <TaskStatusBadge status={task.status} />
                      {isBlockerTask && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          <IconLink className="h-3 w-3" />
                          From blocker
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
