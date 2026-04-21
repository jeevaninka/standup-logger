import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../components/Toast.jsx'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { localDateKey } from '../../lib/date.js'
import { nextTaskStatus } from '../../lib/tasks.js'

import { StandupCard } from './StandupCard.jsx'
import { MyTasksCard } from './MyTasksCard.jsx'
import { TeamTodayGrid } from './TeamTodayGrid.jsx'
import { IconRefresh } from '../../components/icons/index.jsx'

function formatDisplayDate(dateKey) {
  const [y, m, day] = dateKey.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function TodayPanel() {
  const { user } = useAuth()
  const showToast = useToast()
  useDocumentTitle('Today | Standup Logger')
  const dateKey = useMemo(() => localDateKey(), [])

  const [displayName, setDisplayName] = useState('')
  const [standupLoading, setStandupLoading] = useState(true)
  const [existingStandup, setExistingStandup] = useState(null)
  const [standupError, setStandupError] = useState('')

  const [tasksLoading, setTasksLoading] = useState(true)
  const [tasks, setTasks] = useState([])

  const [convertingBlocker, setConvertingBlocker] = useState(null)

  const [teamLoading, setTeamLoading] = useState(true)
  const [teamRows, setTeamRows] = useState([])
  const [blockerTaskMap, setBlockerTaskMap] = useState({})

  const userId = user?.id

  const loadProfile = useCallback(async () => {
    if (!userId) return
    const metaName = user.user_metadata?.full_name
    if (metaName) setDisplayName(metaName)
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    if (data?.full_name) setDisplayName(data.full_name)
  }, [userId, user])

  const loadMyStandup = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('standups')
      .select('id, yesterday_work, today_work, blockers, submitted_at')
      .eq('user_id', userId)
      .eq('standup_date', dateKey)
      .maybeSingle()
    if (error) {
      setStandupError(error.message)
      setExistingStandup(null)
      return
    }
    if (data) {
      setExistingStandup(data)
      setStandupError('')
    } else {
      setExistingStandup(null)
      setStandupError('')
    }
  }, [userId, dateKey])

  const loadTasks = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, blocker_source_id')
      .eq('user_id', userId)
      .eq('task_date', dateKey)
      .order('id', { ascending: true })
    if (!error && data) setTasks(data)
  }, [userId, dateKey])

  const loadTeam = useCallback(async () => {
    const { data, error } = await supabase
      .from('standups')
      .select(
        `id, user_id, yesterday_work, today_work, blockers, submitted_at, profiles ( full_name )`,
      )
      .eq('standup_date', dateKey)
      .order('submitted_at', { ascending: true })
    
    if (!error && data) {
      setTeamRows(data)

      const blockerStandupIds = data.filter((r) => (r.blockers ?? '').trim()).map((r) => r.id)
      
      let allBlockerTasks = []
      // 1) Fetch tasks linked by ID
      if (blockerStandupIds.length > 0) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('id, title, status, blocker_source_id, user_id, profiles!tasks_user_id_fkey ( full_name )')
          .in('blocker_source_id', blockerStandupIds)
          .order('id', { ascending: true })
        if (taskData) allBlockerTasks = allBlockerTasks.concat(taskData)
      }

      // 2) Fetch fallback tasks created by matching "[Blocker]" prefix for the current day
      // (This helps catch tasks added before the blocker_source_id column was reliably populated)
      const { data: fallbackTasks } = await supabase
        .from('tasks')
        .select('id, title, status, blocker_source_id, user_id, profiles!tasks_user_id_fkey ( full_name )')
        .eq('task_date', dateKey)
        .is('blocker_source_id', null)
        .like('title', '[Blocker]%')
        .order('id', { ascending: true })
        
      if (fallbackTasks) allBlockerTasks = allBlockerTasks.concat(fallbackTasks)

      const map = {}
      for (const row of data) {
        const bText = (row.blockers ?? '').trim()
        if (!bText) continue
        
        // Find tasks explicitly linked via ID, OR implicitly linked via title substring fallback
        const matches = allBlockerTasks.filter(t => {
          if (t.blocker_source_id === row.id) return true
          if (!t.blocker_source_id && t.title.startsWith('[Blocker]') && t.title.includes(bText.slice(0, 50))) {
            return true
          }
          return false
        })
        
        if (matches.length > 0) {
          map[row.id] = matches
        }
      }
      setBlockerTaskMap(map)
    }
  }, [dateKey])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!userId) return
      setStandupLoading(true)
      setTasksLoading(true)
      setTeamLoading(true)
      await loadProfile()
      if (cancelled) return
      await Promise.all([loadMyStandup(), loadTasks(), loadTeam()])
      if (cancelled) return
      setStandupLoading(false)
      setTasksLoading(false)
      setTeamLoading(false)
    }
    boot()
    return () => { cancelled = true }
  }, [userId, loadProfile, loadMyStandup, loadTasks, loadTeam])

  const handleRefreshAll = useCallback(async () => {
    setStandupLoading(true)
    setTasksLoading(true)
    setTeamLoading(true)
    await Promise.all([loadMyStandup(), loadTasks(), loadTeam()])
    setStandupLoading(false)
    setTasksLoading(false)
    setTeamLoading(false)
  }, [loadMyStandup, loadTasks, loadTeam])

  const greetingName = displayName || user?.email?.split('@')[0] || 'there'

  async function handleStandupSubmit({ yesterday_work, today_work, blockers, wasEditing }) {
    if (!userId) return
    setStandupError('')
    try {
      const payload = {
        user_id: userId,
        standup_date: dateKey,
        yesterday_work: yesterday_work.trim(),
        today_work: today_work.trim(),
        blockers: blockers.trim() || null,
        submitted_at: new Date().toISOString(),
      }
      let error = null
      if (wasEditing) {
        const res = await supabase
          .from('standups')
          .update({
            yesterday_work: payload.yesterday_work,
            today_work: payload.today_work,
            blockers: payload.blockers,
            submitted_at: payload.submitted_at,
          })
          .eq('id', existingStandup.id)
          .eq('user_id', userId)
        error = res.error
      } else {
        const res = await supabase.from('standups').insert(payload)
        error = res.error
      }
      if (error) { setStandupError(error.message); return }
      logger.info(wasEditing ? 'standup edited' : 'standup submitted', { userId, date: dateKey })
      showToast('Standup saved', 'success')
      await loadMyStandup()
      await loadTeam()
    } catch (err) {
      logger.error('standup submit failed', {
        error: err instanceof Error ? err.message : String(err),
      })
      setStandupError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  async function handleAddTask(title) {
    if (!userId) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, task_date: dateKey, title, status: 'todo' })
      .select('id, title, status, blocker_source_id')
      .single()
    if (!error && data) {
      setTasks((prev) => [...prev, data])
    }
  }

  async function handleCycleTaskStatus(task) {
    const next = nextTaskStatus(task.status)
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', task.id)
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
      // Reload team to update blocker task statuses for everyone else's view
      await loadTeam()
    }
  }

  async function convertBlockerToTask(standup) {
    if (!userId || !standup.blockers?.trim()) return
    setConvertingBlocker(standup.id)
    try {
      const title = `[Blocker] ${standup.blockers.trim().slice(0, 120)}`
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          task_date: dateKey,
          title,
          status: 'todo',
          blocker_source_id: standup.id,
        })
        .select('id, title, status, blocker_source_id')
        .single()
      if (!error && data) {
        setTasks((prev) => [...prev, data])
        showToast('Blocker added as task', 'success')
        logger.info('blocker converted to task', { userId, standupId: standup.id, date: dateKey })
        await loadTeam()
      } else if (error) {
        showToast('Failed to create task', 'error')
      }
    } finally {
      setConvertingBlocker(null)
    }
  }

  return (
    <div className="p-4 pb-24 md:p-8 md:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <StandupCard
            loading={standupLoading}
            existingStandup={existingStandup}
            error={standupError}
            onSubmit={handleStandupSubmit}
            greetingName={greetingName}
            getGreeting={getGreeting}
          />
          <MyTasksCard
            loading={tasksLoading}
            tasks={tasks}
            onAddTask={handleAddTask}
            onCycleTaskStatus={handleCycleTaskStatus}
          />
        </div>
        
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-8">
          <div className="flex items-baseline gap-3">
            <h3 className="text-lg font-semibold text-slate-900">Team Today</h3>
            <span className="text-sm text-slate-400">{formatDisplayDate(dateKey)}</span>
          </div>
          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
          >
            <IconRefresh className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <TeamTodayGrid
          loading={teamLoading}
          teamRows={teamRows}
          currentUserId={userId}
          dateKey={dateKey}
          formatDisplayDate={formatDisplayDate}
          convertingBlockerId={convertingBlocker}
          onConvertBlocker={convertBlockerToTask}
          blockerTaskMap={blockerTaskMap}
        />
      </div>
    </div>
  )
}
