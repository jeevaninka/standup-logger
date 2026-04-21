import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'
import { Spinner } from '../components/Spinner.jsx'
import { TaskStatusBadge } from '../components/TaskStatusBadge.jsx'
import { IconClipboard, IconPencil, IconLink, IconTrash, IconBug, IconJira, IconChevronDown, IconChevronRight } from '../components/icons/index.jsx'
import { localDateKey } from '../lib/date.js'
import { TASK_STATUSES, nextTaskStatus, statusBadgeClasses, statusLabel } from '../lib/tasks.js'
import { resolveProfileName } from '../lib/profile.js'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:ring-offset-0'

const SECTIONS = [
  { status: 'todo', label: 'To Do', empty: 'Nothing here yet.' },
  { status: 'in_progress', label: 'In Progress', empty: 'Nothing in progress.' },
  { status: 'done', label: 'Done', empty: 'No completed tasks yet.' },
]

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'task', label: 'Tasks' },
  { key: 'bug', label: 'Bugs' },
  { key: 'blockers', label: 'From Blockers' },
]

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

function TaskCard({ task, onCycleStatus, onDelete, onEdit, statusUpdatingId, currentUserId, profiles }) {
  const overdue = task.status !== 'done' && isOverdue(task.due_date)
  const dueLabel = formatDueDate(task.due_date)
  const updating = statusUpdatingId === task.id
  const isFromBlocker = Boolean(task.blocker_source_id)
  const isOwnTask = task.user_id === currentUserId

  const [editing, setEditing] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDue, setEditDue] = useState(task.due_date ?? '')
  const [editAssignee, setEditAssignee] = useState(task.user_id ?? '')
  const [editTaskType, setEditTaskType] = useState(task.task_type ?? 'task')
  const [editJiraLink, setEditJiraLink] = useState(task.jira_link ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) {
      setEditTitle(task.title)
      setEditDue(task.due_date ?? '')
      setEditAssignee(task.user_id ?? '')
      setEditTaskType(task.task_type ?? 'task')
      setEditJiraLink(task.jira_link ?? '')
    }
  }, [task.title, task.due_date, task.user_id, task.task_type, task.jira_link, editing])

  function handleEditOpen() {
    setEditTitle(task.title)
    setEditDue(task.due_date ?? '')
    setEditAssignee(task.user_id ?? '')
    setEditTaskType(task.task_type ?? 'task')
    setEditJiraLink(task.jira_link ?? '')
    setEditing(true)
  }

  async function handleEditSave() {
    const title = editTitle.trim()
    if (!title) return
    setSaving(true)
    await onEdit(task, { title, due_date: editDue.trim() || null, user_id: editAssignee || task.user_id, task_type: editTaskType, jira_link: editJiraLink.trim() || null })
    setSaving(false)
    setEditing(false)
  }

  const assigneeName = resolveProfileName(profiles.find(p => p.id === task.user_id))

  if (editing) {
    return (
      <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit task</p>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title <span className="text-red-500">*</span></label>
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditing(false) }}
              className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm ${inputFocus}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Assigned to</label>
            <select
              value={editAssignee}
              onChange={(e) => setEditAssignee(e.target.value)}
              className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${inputFocus}`}
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{resolveProfileName(p)}{p.id === currentUserId ? ' (you)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Due date <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              type="date"
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
              className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${inputFocus}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
            <select
              value={editTaskType}
              onChange={(e) => setEditTaskType(e.target.value)}
              className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${inputFocus}`}
            >
              <option value="task">Task</option>
              <option value="bug">Bug</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Jira Link <span className="font-normal text-slate-400">(optional)</span></label>
            <input
              type="url"
              value={editJiraLink}
              onChange={(e) => setEditJiraLink(e.target.value)}
              placeholder="https://jira.company.com/browse/PROJ-123"
              className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus}`}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={saving || !editTitle.trim()}
            onClick={handleEditSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Spinner size="sm" className="text-white" /> : null}
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
        </div>
      </article>
    )
  }

  return (
    <article id={`task-${task.id}`} className={`relative flex flex-col rounded-2xl border p-4 shadow-sm ring-1 transition-all duration-200 ${isFromBlocker ? 'bg-amber-100 border-l-4 border-l-amber-400 border-amber-200 ring-amber-100' : task.task_type === 'bug' ? 'bg-red-50 border-l-4 border-l-red-400 border-red-200 ring-red-100' : 'bg-white border-slate-200 ring-slate-100'} ${isExpanded ? 'h-auto' : ''}`}>
      {isFromBlocker && (
        <div className="mb-2 flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            <IconLink className="h-3 w-3" />
            From blocker
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            {task.task_type === 'bug' ? (
              <span className="flex shrink-0 items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600" title="Bug">
                <IconBug className="h-3 w-3" />
                Bug
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500" title="Task">
                <IconClipboard className="h-3 w-3" />
                Task
              </span>
            )}
          </div>
          <h3 className={`font-medium text-slate-900 break-words leading-tight ${isExpanded ? '' : 'line-clamp-2'}`}>{task.title}</h3>
        </div>
        {isOwnTask && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={handleEditOpen} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Edit">
              <IconPencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onDelete(task)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Delete">
              <IconTrash className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {!isOwnTask && (
        <p className="mt-1 text-xs text-slate-400">Assigned to <span className="font-medium text-slate-600">{assigneeName}</span></p>
      )}

      {dueLabel ? (
        <p className={`mt-2 text-sm ${overdue ? 'font-medium text-red-600' : 'text-slate-600'}`}>
          Due {dueLabel}{overdue ? ' · Overdue' : ''}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={updating || !isOwnTask}
          onClick={() => isOwnTask && onCycleStatus(task)}
          title={!isOwnTask ? "Only the assignee can update status" : undefined}
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${statusBadgeClasses(task.status)}`}
        >
          {updating ? <Spinner size="sm" /> : null}
          {statusLabel(task.status)}
        </button>
        {task.jira_link && (
          <a
            href={task.jira_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-blue-600"
          >
            <IconJira className="h-3.5 w-3.5" />
            Jira
          </a>
        )}
      </div>

      {isExpanded && (
        <>
          {task.assignee_history && task.assignee_history.length > 1 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 transition focus:outline-none focus:underline"
              >
                {showHistory ? 'Hide history' : 'Show history'}
              </button>
              {showHistory && (
                <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {task.assignee_history.map((h, i) => {
                    const isLast = i === task.assignee_history.length - 1
                    const name = resolveProfileName(profiles.find(p => p.id === h.uid)) || 'Unknown'
                    return (
                      <span key={i}>
                        {name}
                        {!isLast && ' → '}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Expand/Collapse Chevron */}
      <div className="mt-auto pt-2 flex justify-center border-t border-slate-100/50">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
          aria-label={isExpanded ? "Collapse card" : "Expand card"}
        >
          {isExpanded ? <IconChevronUp className="h-4 w-4" /> : <IconChevronDown className="h-4 w-4" />}
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
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [activeFilter, setActiveFilter] = useState('all')

  const [showAddForm, setShowAddForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDue, setFormDue] = useState('')
  const [formStatus, setFormStatus] = useState('todo')
  const [formAssignee, setFormAssignee] = useState('')
  const [saving, setSaving] = useState(false)

  const [formTaskType, setFormTaskType] = useState('task')
  const [formJiraLink, setFormJiraLink] = useState('')

  const [statusUpdatingId, setStatusUpdatingId] = useState(null)

  const [selectedUserFilter, setSelectedUserFilter] = useState('all')

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, full_name')
    if (data) setProfiles(data)
  }, [])

  const loadTasks = useCallback(async () => {
    if (!userId) return
    // Load ALL tasks (all users) — RLS must allow SELECT for team tasks
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, task_date, blocker_source_id, user_id, task_type, jira_link, assignee_history')
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
        await Promise.all([loadTasks(), loadProfiles()])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId, loadTasks, loadProfiles])

  // Default assignee to self once profiles loaded
  useEffect(() => {
    if (userId && !formAssignee) setFormAssignee(userId)
  }, [userId, formAssignee])

  const visibleTasks = useMemo(() => {
    let filtered = tasks
    if (selectedUserFilter !== 'all') {
      filtered = filtered.filter(t => t.user_id === selectedUserFilter)
    }
    if (activeFilter === 'blockers') return filtered.filter((t) => Boolean(t.blocker_source_id))
    if (activeFilter === 'task') return filtered.filter((t) => t.task_type !== 'bug')
    if (activeFilter === 'bug') return filtered.filter((t) => t.task_type === 'bug')
    return filtered
  }, [tasks, activeFilter, selectedUserFilter])

  const [collapsedUsers, setCollapsedUsers] = useState({})

  const userGroups = useMemo(() => {
    const map = new Map()
    for (const t of visibleTasks) {
      const uid = t.user_id
      if (!map.has(uid)) map.set(uid, [])
      map.get(uid).push(t)
    }
    const entries = [...map.entries()]
    entries.sort(([a], [b]) => {
      if (a === userId) return -1
      if (b === userId) return 1
      const nameA = resolveProfileName(profiles.find(p => p.id === a)) || ''
      const nameB = resolveProfileName(profiles.find(p => p.id === b)) || ''
      return nameA.localeCompare(nameB)
    })
    return entries.map(([uid, userTasks]) => {
      const profile = profiles.find(p => p.id === uid)
      const name = resolveProfileName(profile) || uid
      const grouped = { todo: [], in_progress: [], done: [] }
      for (const t of userTasks) {
        const key = TASK_STATUSES.includes(t.status) ? t.status : 'todo'
        grouped[key].push(t)
      }
      return { uid, name, grouped, isMe: uid === userId }
    })
  }, [visibleTasks, profiles, userId])

  // Initialize all to collapsed if not already in state
  useEffect(() => {
    setCollapsedUsers(prev => {
      let changed = false
      const copy = { ...prev }
      for (const group of userGroups) {
        if (copy[group.uid] === undefined) {
          copy[group.uid] = true // collapsed by default
          changed = true
        }
      }
      return changed ? copy : prev
    })
  }, [userGroups])

  function toggleUserCollapse(uid) {
    setCollapsedUsers(prev => ({ ...prev, [uid]: !prev[uid] }))
  }

  const blockerCount = useMemo(() => tasks.filter((t) => Boolean(t.blocker_source_id)).length, [tasks])

  async function handleSaveNew(e) {
    e.preventDefault()
    const title = formTitle.trim()
    if (!title || !userId) return
    setSaving(true)
    const assignTo = formAssignee || userId
    const initialHistory = [{ uid: assignTo, assigned_at: new Date().toISOString() }]
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: assignTo,
        title,
        status: formStatus,
        due_date: formDue.trim() || null,
        task_date: localDateKey(),
        task_type: formTaskType,
        jira_link: formJiraLink.trim() || null,
        assignee_history: initialHistory
      })
      .select('id, title, status, due_date, task_date, blocker_source_id, user_id, task_type, jira_link, assignee_history')
      .single()
    setSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    if (data) {
      logger.info('task added', { userId, title, assignTo })
      showToast('Task added', 'success')
      setTasks((prev) => [...prev, data])
    }
    setFormTitle(''); setFormDue(''); setFormStatus('todo'); setFormAssignee(userId); setFormTaskType('task'); setFormJiraLink(''); setShowAddForm(false)
  }

  async function handleCycleStatus(task) {
    const next = nextTaskStatus(task.status)
    setStatusUpdatingId(task.id)
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id).eq('user_id', task.user_id)
    setStatusUpdatingId(null)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Status updated', 'success')
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
  }

  async function handleDelete(task) {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', task.user_id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Task deleted', 'success')
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
  }

  async function handleEdit(task, { title, due_date, user_id: newUserId, task_type, jira_link }) {
    let history = task.assignee_history ?? []
    if (!Array.isArray(history)) history = []
    
    let newHistory = history
    if (newUserId !== task.user_id) {
      newHistory = [...history, { uid: newUserId, assigned_at: new Date().toISOString() }]
    }

    const { error } = await supabase
      .from('tasks')
      .update({ title, due_date, user_id: newUserId, task_type, jira_link, assignee_history: newHistory })
      .eq('id', task.id)
      .eq('user_id', task.user_id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Task updated', 'success')
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title, due_date, user_id: newUserId, task_type, jira_link, assignee_history: newHistory } : t)))
  }

  function cancelAdd() {
    setShowAddForm(false); setFormTitle(''); setFormDue(''); setFormStatus('todo'); setFormAssignee(userId); setFormTaskType('task'); setFormJiraLink('')
  }

  const totalVisible = visibleTasks.length
  const doneCount = visibleTasks.filter((t) => t.status === 'done').length

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 md:p-8 md:pb-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tasks</h1>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] sm:w-auto"
          >
            + Add Task
          </button>
        </header>

        {loadError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">{loadError}</p>
        ) : null}

        {/* Filter tabs */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400 ${activeFilter === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab.label}
                {tab.key === 'blockers' && blockerCount > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${activeFilter === 'blockers' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                    {blockerCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="user-filter" className="sr-only">Team Member</label>
            <select
              id="user-filter"
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className={`block w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ${inputFocus}`}
            >
              <option value="all">All team members</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{resolveProfileName(p)}{p.id === userId ? ' (you)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Add task form */}
        {showAddForm ? (
          <form onSubmit={handleSaveNew} className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">New task</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="task-title" className="block text-sm font-medium text-slate-700">Title <span className="text-red-600">*</span></label>
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
                <label htmlFor="task-assignee" className="block text-sm font-medium text-slate-700">Assign to</label>
                <select
                  id="task-assignee"
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{resolveProfileName(p)}{p.id === userId ? ' (you)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-status" className="block text-sm font-medium text-slate-700">Status</label>
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
              <div>
                <label htmlFor="task-due" className="block text-sm font-medium text-slate-700">Due date <span className="font-normal text-slate-500">(optional)</span></label>
                <input
                  id="task-due"
                  type="date"
                  value={formDue}
                  onChange={(e) => setFormDue(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
                />
              </div>
              <div>
                <label htmlFor="task-type" className="block text-sm font-medium text-slate-700">Type</label>
                <select
                  id="task-type"
                  value={formTaskType}
                  onChange={(e) => setFormTaskType(e.target.value)}
                  className={`mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="task-jira" className="block text-sm font-medium text-slate-700">Jira Link <span className="font-normal text-slate-500">(optional)</span></label>
                <input
                  id="task-jira"
                  type="url"
                  value={formJiraLink}
                  onChange={(e) => setFormJiraLink(e.target.value)}
                  placeholder="https://jira.company.com/browse/PROJ-123"
                  className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus}`}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Spinner size="sm" className="text-white" /> : null}
                Save
              </button>
              <button type="button" onClick={cancelAdd} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
            </div>
          </form>
        ) : null}

        {/* Task groups */}
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
        ) : userGroups.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<IconClipboard className="mx-auto" />} title="No tasks yet — add one above" description="Use + Add Task to create your first one." />
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {userGroups.map(({ uid, name, grouped, isMe }) => {
              const isCollapsed = collapsedUsers[uid] ?? true
              return (
              <section key={uid}>
                {/* User heading */}
                <button
                  type="button"
                  onClick={() => toggleUserCollapse(uid)}
                  className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg bg-slate-200/50 px-4 py-3 text-left transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900">
                      {isMe ? `${name} (you)` : name}
                    </h2>
                    <span className="text-sm text-slate-500">
                      {Object.values(grouped).flat().length} task{Object.values(grouped).flat().length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {isCollapsed ? <IconChevronRight className="h-5 w-5" /> : <IconChevronDown className="h-5 w-5" />}
                  </div>
                </button>

                {/* Kanban columns */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {SECTIONS.map(({ status, label, empty }) => {
                      const list = grouped[status] ?? []
                      const topBorder = status === 'todo' ? 'border-t-slate-300' : status === 'in_progress' ? 'border-t-amber-400' : 'border-t-emerald-400'
                      return (
                        <section key={status} className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 border-t-4 ${topBorder}`}>
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</h3>
                            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">{list.length}</span>
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
                                  currentUserId={userId}
                                  profiles={profiles}
                                />
                              ))
                            )}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>
            )})}
          </div>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-600">
          {loading ? null : (
            <p>
              <span className="font-semibold text-slate-900">{totalVisible}</span> task{totalVisible !== 1 ? 's' : ''}
              {activeFilter === 'blockers' ? ' from blockers' : ' total'},{' '}
              <span className="font-semibold text-slate-900">{doneCount}</span> done
            </p>
          )}
        </footer>
      </div>
    </div>
  )
}
