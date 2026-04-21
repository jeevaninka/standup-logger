import { TaskStatusBadge } from '../../components/TaskStatusBadge.jsx'
import { Spinner } from '../../components/Spinner.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { IconUsers, IconLink, IconArrowRight } from '../../components/icons/index.jsx'
import { resolveProfileName, getInitials } from '../../lib/profile.js'

function formatSubmittedTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TeamTodayGrid({
  loading,
  teamRows,
  currentUserId,
  dateKey,
  formatDisplayDate,
  convertingBlockerId,
  onConvertBlocker,
  blockerTaskMap = {}
}) {
  if (loading) {
    return (
      <div className="mt-10 animate-pulse">
        <div className="mb-4 h-7 w-64 rounded-lg bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="h-56 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
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
    <section className="mt-8 border-t border-slate-100 pt-8">
      <div className="flex items-baseline gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Team Today</h3>
        <span className="text-sm text-slate-400">{formatDisplayDate(dateKey)}</span>
      </div>
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
          {teamRows.map((row) => {
            const name = resolveProfileName(row.profiles) || 'Teammate'
            const initials = getInitials(name, '')
            const blockerText = (row.blockers || '').trim()
            const isOwnStandup = row.user_id === currentUserId
            const linkedTasks = blockerTaskMap[row.id] ?? []

            return (
              <article
                key={row.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ring-1 ring-black/[0.03] transition hover:shadow-md"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white"
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
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

                {/* Card body */}
                <dl className="flex-1 space-y-3 px-5 py-4 text-sm">
                  {[
                    { dt: 'Yesterday', dd: row.yesterday_work },
                    { dt: 'Today', dd: row.today_work },
                  ].map(({ dt, dd }) => (
                    <div key={dt}>
                      <dt className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-slate-400">{dt}</dt>
                      <dd className="whitespace-pre-wrap leading-relaxed text-slate-700">{dd || '—'}</dd>
                    </div>
                  ))}

                  {/* Blocker section with convert-to-task action */}
                  <div>
                    <dt className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-amber-500">Blockers</dt>
                    <dd>
                      {blockerText ? (
                        <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
                          <p className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed text-amber-900">
                            {blockerText}
                          </p>
                          {/* ── Blocker → Task CTA & Status ── */}
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
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-600/10">
                                  Open
                                </span>
                                {!isOwnStandup && (
                                  <button
                                    type="button"
                                    disabled={convertingBlockerId === row.id}
                                    onClick={() => onConvertBlocker(row)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60"
                                  >
                                    {convertingBlockerId === row.id ? (
                                      <><Spinner size="sm" className="text-amber-200" /> Adding…</>
                                    ) : (
                                      <><IconArrowRight className="h-3.5 w-3.5" /> Convert to task</>
                                    )}
                                  </button>
                                )}
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
          })}
        </div>
      )}
    </section>
  )
}
