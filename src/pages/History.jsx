import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { EmptyState } from '../components/EmptyState.jsx'
import { supabase } from '../lib/supabase.js'
import { parseLocalDate, formatCardDate } from '../lib/date.js'
import { resolveProfileName } from '../lib/profile.js'
import { IconLink, IconHistory, IconChevronDown, IconChevronRight } from '../components/icons/index.jsx'
import { TaskStatusBadge } from '../components/TaskStatusBadge.jsx'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:ring-offset-0'

function dayHeading(yyyyMmDd) {
  const d = parseLocalDate(yyyyMmDd)
  if (!d) return ''
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function dayKeyFromDate(yyyyMmDd) {
  return yyyyMmDd // Already exact day like 2023-10-24
}

// ── Card Component ────────────────────────────────────────────────────────────

function HistoryCard({ row, linkedTasks }) {
  const blockerText = (row.blockers ?? '').trim()

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition ring-1 ring-black/[0.02]">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-white px-5 py-4">
        <p className="font-semibold text-slate-900">{formatCardDate(row.standup_date)}</p>
        <p className="shrink-0 text-xs font-medium text-slate-500">
          {resolveProfileName(row.profiles)}
        </p>
      </div>

      {/* Card body */}
      <dl className="flex-1 space-y-3 px-5 py-4 text-sm">
        {/* Yesterday */}
        <div>
          <dt className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Yesterday</dt>
          <dd className="whitespace-pre-wrap leading-relaxed text-slate-700">
            {row.yesterday_work?.trim() || '—'}
          </dd>
        </div>

        {/* Today */}
        <div>
          <dt className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Today</dt>
          <dd className="whitespace-pre-wrap leading-relaxed text-slate-700">
            {row.today_work?.trim() || '—'}
          </dd>
        </div>

        {/* Blockers */}
        <div>
          <dt className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-amber-500">Blockers</dt>
          <dd>
            {blockerText ? (
              <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
                <p className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed text-amber-900">
                  {blockerText}
                </p>
                <div className="border-t border-amber-200/70 bg-amber-50/80 px-3 py-2 flex flex-col gap-2">
                  {linkedTasks.length > 0 ? (
                    linkedTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-800">
                            → Picked up by <span className="font-medium text-amber-900">{resolveProfileName(task.profiles)}</span>
                          </span>
                        </div>
                        <TaskStatusBadge status={task.status} />
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/10">
                        Open
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                No blockers
              </span>
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function History() {
  useDocumentTitle('History | Standup Logger')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [collapsedDays, setCollapsedDays] = useState({})

  // blocker tasks keyed by standup id: { [standupId]: Task[] }
  const [blockerTaskMap, setBlockerTaskMap] = useState({})

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Load standups
  const loadStandups = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('standups')
      .select(`
        id,
        user_id,
        standup_date,
        yesterday_work,
        today_work,
        blockers,
        profiles ( full_name ),
        notes ( id, content, created_at )
      `)
      .order('standup_date', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      return
    }
    setError('')
    setRows(data ?? [])
    return data ?? []
  }, [])

  // Load blocker-derived tasks for all standups that have blockers
  const loadBlockerTasks = useCallback(async (standupRows) => {
    const blockerStandupIds = (standupRows ?? [])
      .filter((r) => (r.blockers ?? '').trim())
      .map((r) => r.id)

    let allBlockerTasks = []
    
    if (blockerStandupIds.length > 0) {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, blocker_source_id, profiles!tasks_user_id_fkey ( full_name )')
        .in('blocker_source_id', blockerStandupIds)
        .order('id', { ascending: true })
      if (data) allBlockerTasks = allBlockerTasks.concat(data)
    }

    // Fallback: match tasks with "[Blocker]" prefix that might not have a reliable blocker_source_id
    const { data: fallbackTasks } = await supabase
      .from('tasks')
      .select('id, title, status, blocker_source_id, profiles!tasks_user_id_fkey ( full_name )')
      .is('blocker_source_id', null)
      .like('title', '[Blocker]%')
      .order('id', { ascending: true })

    if (fallbackTasks) allBlockerTasks = allBlockerTasks.concat(fallbackTasks)

    const map = {}
    for (const row of standupRows) {
      const bText = (row.blockers ?? '').trim()
      if (!bText) continue
      
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
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const standupData = await loadStandups()
        if (!cancelled && standupData) await loadBlockerTasks(standupData)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [loadStandups, loadBlockerTasks])

  // Unique users for filter dropdown
  const users = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      if (!r?.user_id) continue
      const name = resolveProfileName(r.profiles)
      if (name && !map.has(r.user_id)) map.set(r.user_id, { id: r.user_id, name })
    }
    return Array.from(map.values())
  }, [rows])

  const filtered = useMemo(() => {
    let list = rows

    if (dateFrom) list = list.filter((r) => r.standup_date >= dateFrom)
    if (dateTo) list = list.filter((r) => r.standup_date <= dateTo)
    if (selectedUser !== 'all') list = list.filter((r) => r.user_id === selectedUser)

    if (statusFilter === 'blockers') list = list.filter((r) => (r.blockers ?? '').trim().length > 0)
    else if (statusFilter === 'no_blockers') list = list.filter((r) => !(r.blockers ?? '').trim())

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) => {
        const name = resolveProfileName(r.profiles).toLowerCase()
        const y = (r.yesterday_work ?? '').toLowerCase()
        const t = (r.today_work ?? '').toLowerCase()
        const b = (r.blockers ?? '').toLowerCase()
        return y.includes(q) || t.includes(q) || b.includes(q) || name.includes(q)
      })
    }

    return list
  }, [rows, dateFrom, dateTo, search, selectedUser, statusFilter])

  const dayGroups = useMemo(() => {
    const map = new Map()
    for (const row of filtered) {
      const key = dayKeyFromDate(row.standup_date)
      if (!key) continue
      if (!map.has(key)) map.set(key, { key, heading: dayHeading(row.standup_date), entries: [] })
      map.get(key).entries.push(row)
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([, v]) => v)
  }, [filtered])

  const allCollapsed = dayGroups.every(g => collapsedDays[g.key])

  function toggleAll() {
    if (allCollapsed) {
      setCollapsedDays({})
    } else {
      const newCollapsed = {}
      for (const g of dayGroups) {
        newCollapsed[g.key] = true
      }
      setCollapsedDays(newCollapsed)
    }
  }

  function toggleDay(key) {
    setCollapsedDays(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 md:p-8 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">History</h1>

        {/* Filters */}
        <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${inputFocus}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${inputFocus}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Team member</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${inputFocus}`}
              >
                <option value="all">All team members</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Blockers</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${inputFocus}`}
              >
                <option value="all">All</option>
                <option value="blockers">Has blockers</option>
                <option value="no_blockers">No blockers</option>
              </select>
            </div>
          </div>
          <div className="w-full sm:flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Search</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search standups…"
              className={`block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${inputFocus}`}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> standup{filtered.length !== 1 ? 's' : ''}
          </p>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition focus:outline-none focus:underline"
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>
        ) : null}

        {/* Results */}
        {loading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((k) => (
              <div key={k} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex justify-between">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-4 w-24 rounded bg-slate-200" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-4/5 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : dayGroups.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<IconHistory className="mx-auto" />}
              title="No standups found"
              description="Try adjusting your filters."
            />
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {dayGroups.map((group) => {
              const isCollapsed = collapsedDays[group.key]
              return (
                <section key={group.key}>
                  {/* Day heading (Collapsible) */}
                  <button
                    type="button"
                    onClick={() => toggleDay(group.key)}
                    className="mb-3 flex w-full items-center justify-between rounded-lg bg-slate-200/50 px-3 py-2 text-sm font-semibold uppercase tracking-widest text-slate-500 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  >
                    <span>{group.heading} <span className="ml-2 font-normal normal-case text-slate-400">({group.entries.length})</span></span>
                    {isCollapsed ? (
                      <IconChevronRight className="h-4 w-4" />
                    ) : (
                      <IconChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {group.entries.map((row) => (
                        <HistoryCard
                          key={row.id}
                          row={row}
                          linkedTasks={blockerTaskMap[row.id] ?? []}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
