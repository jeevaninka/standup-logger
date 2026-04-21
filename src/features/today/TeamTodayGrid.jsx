import { useState } from 'react'
import { TaskStatusBadge } from '../../components/TaskStatusBadge.jsx'
import { Spinner } from '../../components/Spinner.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { IconUsers, IconLink, IconArrowRight, IconChevronDown, IconChevronRight } from '../../components/icons/index.jsx'
import { resolveProfileName, getInitials } from '../../lib/profile.js'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:ring-offset-0'

function formatSubmittedTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function BlockerItem({
  standupId,
  blockerText,
  linkedTasks,
  currentUserId,
  convertingBlockerId,
  onConvertBlocker,
  profiles,
}) {
  const [showConvertForm, setShowConvertForm] = useState(false)
  const [assignee, setAssignee] = useState(currentUserId || '')
  const [taskType, setTaskType] = useState('task')
  const [jiraLink, setJiraLink] = useState('')

  const isConverting = convertingBlockerId === blockerText

  const handleConvert = (e) => {
    e.preventDefault()
    onConvertBlocker(standupId, blockerText, {
      assignee,
      taskType,
      jiraLink: jiraLink.trim(),
    })
    setShowConvertForm(false)
  }

  return (
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
        ) : showConvertForm ? (
          <form onSubmit={handleConvert} className="flex flex-col gap-2 bg-white p-2.5 rounded-lg border border-amber-200/60">
            <p className="text-xs font-medium text-slate-700">Convert to task</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500 uppercase tracking-wide">Assign to</label>
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className={`block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm ${inputFocus}`}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{resolveProfileName(p)}{p.id === currentUserId ? ' (you)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500 uppercase tracking-wide">Type</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className={`block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm ${inputFocus}`}
                >
                  <option value="task">Task</option>
                  <option value="bug">Bug</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[10px] font-medium text-slate-500 uppercase tracking-wide">Jira Link (optional)</label>
                <input
                  type="url"
                  value={jiraLink}
                  onChange={(e) => setJiraLink(e.target.value)}
                  placeholder="https://jira.company.com/browse/PROJ-123"
                  className={`block w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="submit"
                disabled={isConverting}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
              >
                {isConverting ? <Spinner size="sm" className="text-blue-200" /> : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setShowConvertForm(false)}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/10">
              Open
            </span>
            <button
              type="button"
              onClick={() => setShowConvertForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <IconArrowRight className="h-3.5 w-3.5" /> Convert to task
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TeamStandupCard({ row, currentUserId, convertingBlockerId, onConvertBlocker, blockerTaskMap, profiles }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const name = resolveProfileName(row.profiles) || 'Teammate'
  const initials = getInitials(name, '')
  const avatarUrl = row.profiles?.avatar_url || ''
  const isOwnStandup = row.user_id === currentUserId
  
  let parsedBlockers = []
  const bText = (row.blockers || '').trim()
  if (bText) {
    try {
      parsedBlockers = JSON.parse(bText)
      if (!Array.isArray(parsedBlockers)) parsedBlockers = [bText]
    } catch {
      parsedBlockers = [bText]
    }
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-md ring-1 ring-black/[0.02] transition hover:shadow-lg">
      {/* Card header */}
      <button 
        type="button" 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-white px-5 py-4 focus:outline-none focus:bg-blue-50/50 transition text-left"
      >
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-400">Submitted {formatSubmittedTime(row.submitted_at)}</p>
          </div>
          {isOwnStandup && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-indigo-200/80">
              You
            </span>
          )}
        </div>
        <div className="text-slate-400 shrink-0">
          {isExpanded ? <IconChevronDown className="h-5 w-5" /> : <IconChevronRight className="h-5 w-5" />}
        </div>
      </button>

      {/* Card body */}
      {isExpanded && (
        <dl className="flex-1 flex flex-col space-y-4 px-5 py-4 text-sm">
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
              {parsedBlockers.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {parsedBlockers.map((b, i) => (
                    <BlockerItem
                      key={i}
                      standupId={row.id}
                      blockerText={b}
                      linkedTasks={blockerTaskMap[row.id]?.[b] ?? []}
                      currentUserId={currentUserId}
                      convertingBlockerId={convertingBlockerId}
                      onConvertBlocker={onConvertBlocker}
                      profiles={profiles}
                    />
                  ))}
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
      )}
    </article>
  )
}

export function TeamTodayGrid({
  loading,
  teamRows,
  currentUserId,
  convertingBlockerId,
  onConvertBlocker,
  blockerTaskMap = {},
  profiles = [],
}) {
  if (loading) {
    return (
      <div className="mt-10 animate-pulse">
        <div className="mb-4 h-7 w-64 rounded-lg bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-56 rounded-xl border border-slate-100 bg-white p-5 shadow-md">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded-lg bg-slate-200" />
                  <div className="h-3 w-24 rounded-lg bg-slate-200" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full rounded-lg bg-slate-100" />
                <div className="h-3 w-4/5 rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="mt-6">
      {teamRows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<IconUsers className="mx-auto" />}
            title="Be the first to submit today"
            description="Your teammates will see standups here once they are shared."
          />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teamRows.map((row) => (
            <TeamStandupCard
              key={row.id}
              row={row}
              currentUserId={currentUserId}
              convertingBlockerId={convertingBlockerId}
              onConvertBlocker={onConvertBlocker}
              blockerTaskMap={blockerTaskMap}
              profiles={profiles}
            />
          ))}
        </div>
      )}
    </section>
  )
}
