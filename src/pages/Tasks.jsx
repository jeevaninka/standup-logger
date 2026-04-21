import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'
import { Spinner } from '../components/Spinner.jsx'
import { TaskStatusBadge } from '../components/TaskStatusBadge.jsx'
import { IconClipboard, IconPencil, IconLink, IconTrash } from '../components/icons/index.jsx'
import { localDateKey } from '../lib/date.js'
import { TASK_STATUSES, nextTaskStatus, statusBadgeClasses, statusLabel } from '../lib/tasks.js'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/80 focus:ring-offset-0'

const SECTIONS = [
  { status: 'todo', label: 'To Do', empty: 'Nothing here yet.' },
  { status: 'in_progress', label: 'In Progress', empty: 'Nothing in progress.' },
  { status: 'done', label: 'Done', empty: 'No completed tasks yet.' },
]

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'blockers', label: 'From Blockers' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDueDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(dueDateStr) {
  if (!dueDateStr) return false
  return dueDateStr < localDateKey()
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({ task, onCycleStatus, onDelete, onEdit, statusUpdatingId }) {
  const overdue = task.status !== 'done' && isOverdue(task.due_date)
  const dueLabel = formatDueDate(task.due_date)
  const updating = statusUpdatingId === task.id
  const isFromBlocker = Boolean(task.blocker_source_id)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDue, setEditDue] = useState(task.due_date ?? '')
  const [saving, setSaving] = useState(false)

   
  useEffect(() => {
    if (!editing) {
      setEditTitle(task.title)
      setEditDue(task.due_date ?? '')
    }
  }, [task.title, task.due_date, editing])

  function handleEditOpen() {
    setEditTitle(task.title)
    setEditDue(task.due_date ?? '')
    setEditing(true)
  }

  function handleEditCancel() {
    setEditing(false)
  }

  async function handleEditSave() {
    const title = editTitle.trim()
    if (!title) return
    setSaving(true)
    await onEdit(task, { title, due_date: editDue.trim() || null })
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit task</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSave()
                if (e.key === 'Escape') handleEditCancel()
              }}
              className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm ${inputFocus}`}
              placeholder="Task title"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Due date <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="date"
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
              className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm ${inputFocus}`}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saving || !editTitle.trim()}
            onClick={handleEditSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:opacity-60"
          >
            {saving ? <Spinner size="sm" className="text-white" /> : null}
            Save
          </button>
          <button
            type="button"
            onClick={handleEditCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
          >
            Cancel
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ring-1 transition ${
        isFromBlocker
          ? 'border-amber-200 ring-amber-100 bg-amber-50/40'
          : 'border-slate-200 ring-slate-100'
      }`}
    >
      {/* Blocker badge */}
      {isFromBlocker && (
        <div className="mb-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            <IconLink className="h-3 w-3" />
            From blocker
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 font-medium text-slate-900">{task.title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleEditOpen}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-0"
            aria-label="Edit task"
          >
            <IconPencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-0"
            aria-label="Delete task"
          >
            <IconTrash className="h-5 w-5" />
          </button>
        </div>
      </div>

      {dueLabel ? (
        <p className={`mt-2 text-sm ${overdue ? 'font-medium text-red-600' : 'text-slate-600'}`}>
          Due {dueLabel}
          {overdue ? ' · Overdue' : ''}
        </p>
      ) : null}

      <div className="mt-3">
        <button
          type="button"
          disabled={updating}
          onClick={() => onCycleStatus(task)}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset transition hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${statusBadgeClasses(task.status)}`}
        >
          {updating ? <Spinner size="sm" /> : null}
          {statusLabel(task.status)}
        </button>
      </div>
    </article>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { user } = useAuth()
  const showToast = useToast()
  useDocumentTitle('Tasks | Standup Logger')
  const userId = user?.id

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'blockers'

  const [showAddForm, setShowAddForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDue, setFormDue] = useState('')
  const [formStatus, setFormStatus] = useState('todo')
  const [saving, setSaving] = useState(false)

  const [statusUpdatingId, setStatusUpdatingId] = useState(null)

  const loadTasks = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, task_date, blocker_source_id')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
    if (error) {
      setLoadError(error.message)
      setTasks([])
      return
    }
    setLoadError('')
    setTasks(data ?? [])
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await loadTasks()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId, loadTasks])

  // Apply "From Blockers" filter then group by status
  const visibleTasks = useMemo(() => {
    if (activeFilter === 'blockers') return tasks.filter((t) => Boolean(t.blocker_source_id))
    return tasks
  }, [tasks, activeFilter])

  const grouped = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] }
    for (const t of visibleTasks) {
      const key = TASK_STATUSES.includes(t.status) ? t.status : 'todo'
      map[key].push(t)
    }
    return map
  }, [visibleTasks])

  const blockerCount = useMemo(() => tasks.filter((t) => Boolean(t.blocker_source_id)).length, [tasks])
  const total = visibleTasks.length
  const doneCount = visibleTasks.filter((t) => t.status === 'done').length

  async function handleSaveNew(e) {
    e.preventDefault()
    const title = formTitle.trim()
    if (!title || !userId) return
    setSaving(true)
    const row = {
      user_id: userId,
      title,
      status: formStatus,
      due_date: formDue.trim() || null,
      task_date: localDateKey(),
    }
    const { data, error } = await supabase
      .from('tasks')
      .insert(row)
      .select('id, title, status, due_date, task_date, blocker_source_id')
      .single()
    setSaving(false)
    if (error) {
      setLoadError(error.message)
      showToast(error.message, 'error')
      return
    }
    if (data) {
      logger.info('task added', { userId, title })
      showToast('Task added', 'success')
      setTasks((prev) => [...prev, data])
    }
    setFormTitle('')
    setFormDue('')
    setFormStatus('todo')
    setShowAddForm(false)
    setLoadError('')
  }

  async function handleCycleStatus(task) {
    const next = nextTaskStatus(task.status)
    setStatusUpdatingId(task.id)
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id).eq('user_id', userId)
    setStatusUpdatingId(null)
    if (error) {
      setLoadError(error.message)
      showToast(error.message, 'error')
      return
    }
    logger.info('task status changed', { userId, taskId: task.id, status: next })
    showToast('Status updated', 'success')
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    setLoadError('')
  }

  async function handleDelete(task) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', userId)
    if (error) {
      setLoadError(error.message)
      showToast(error.message, 'error')
      return
    }
    showToast('Task deleted', 'success')
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    setLoadError('')
  }

  async function handleEdit(task, { title, due_date }) {
    const { error } = await supabase
      .from('tasks')
      .update({ title, due_date })
      .eq('id', task.id)
      .eq('user_id', userId)
    if (error) {
      setLoadError(error.message)
      showToast(error.message, 'error')
      return
    }
    logger.info('task edited', { userId, taskId: task.id, title, due_date })
    showToast('Task updated', 'success')
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title, due_date } : t)))
    setLoadError('')
  }

  function cancelAdd() {
    setShowAddForm(false)
    setFormTitle('')
    setFormDue('')
    setFormStatus('todo')
    setLoadError('')
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 md:p-8 md:pb-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Tasks</h1>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 sm:w-auto"
          >
            + Add Task
          </button>
        </header>

        {loadError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
            {loadError}
          </p>
        ) : null}

        {/* ── Filter tabs ── */}
        <div className="mt-6 flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 ${
                activeFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.key === 'blockers' && blockerCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    activeFilter === 'blockers'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {blockerCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* From Blockers empty state hint */}
        {activeFilter === 'blockers' && !loading && blockerCount === 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No blocker-derived tasks yet. Use <strong>"Convert to task"</strong> on a teammate's blocker in the Today view.
          </div>
        )}

        {/* Add task form */}
        {showAddForm ? (
          <form
            onSubmit={handleSaveNew}
            className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100"
          >
            <h2 className="text-lg font-semibold text-slate-900">New task</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="task-title" className="block text-sm font-medium text-slate-700">
                  Title <span className="text-red-600">*</span>
                </label>
                <input
                  id="task-title"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
                  placeholder="What needs to be done?"
                />
              </div>
              <div>
                <label htmlFor="task-due" className="block text-sm font-medium text-slate-700">
                  Due date <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="task-due"
                  type="date"
                  value={formDue}
                  onChange={(e) => setFormDue(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
                />
              </div>
              <div>
                <label htmlFor="task-status" className="block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  id="task-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 sm:w-auto"
              >
                {saving ? <Spinner size="sm" className="text-white" /> : null}
                Save
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {/* Kanban columns */}
        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map((k) => (
              <div key={k} className="animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="h-5 w-24 rounded bg-slate-200" />
                <div className="h-24 rounded-lg bg-slate-100" />
                <div className="h-24 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 && activeFilter === 'all' ? (
          <div className="mt-8">
            <EmptyState
              icon={<IconClipboard className="mx-auto" />}
              title="No tasks yet — add one above"
              description="Use + Add Task to create your first one."
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {SECTIONS.map(({ status, label, empty }) => {
              const list = grouped[status] ?? []
              return (
                <section key={status} className="flex flex-col rounded-xl border border-slate-200 bg-slate-100/60 p-4 ring-1 ring-slate-200/80">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</h2>
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                      {list.length}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    {list.length === 0 ? (
                      <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/80 px-4 py-10 text-center text-sm text-slate-500">
                        {activeFilter === 'blockers' ? 'No blocker tasks here.' : empty}
                      </p>
                    ) : (
                      list.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onCycleStatus={handleCycleStatus}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          statusUpdatingId={statusUpdatingId}
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-600">
          {loading ? (
            <p className="text-slate-400">Loading task summary…</p>
          ) : (
            <p>
              <span className="font-semibold text-slate-900">{total}</span> task{total !== 1 ? 's' : ''}
              {activeFilter === 'blockers' ? ' from blockers' : ' total'},{' '}
              <span className="font-semibold text-slate-900">{doneCount}</span> done
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}
