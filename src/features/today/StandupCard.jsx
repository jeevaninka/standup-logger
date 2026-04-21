import { useState, useEffect } from 'react'
import { Spinner } from '../../components/Spinner.jsx'

export function StandupCard({
  loading,
  existingStandup,
  error,
  onSubmit,
  greetingName,
  getGreeting,
}) {
  const [editMode, setEditMode] = useState(false)
  const [yesterday, setYesterday] = useState('')
  const [todayPlans, setTodayPlans] = useState('')
  const [hasBlocker, setHasBlocker] = useState(false)
  const [blockers, setBlockers] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (existingStandup && !editMode) {
      setYesterday(existingStandup.yesterday_work ?? '')
      setTodayPlans(existingStandup.today_work ?? '')
      const blockerText = existingStandup.blockers?.trim() ?? ''
      setHasBlocker(Boolean(blockerText))
      setBlockers(blockerText)
    } else if (!existingStandup) {
      setEditMode(true)
    }
  }, [existingStandup, editMode])

  function handleToggleBlocker(val) {
    setHasBlocker(val)
    if (!val) setBlockers('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit({
      yesterday_work: yesterday,
      today_work: todayPlans,
      blockers: hasBlocker ? blockers : '',
      wasEditing: Boolean(existingStandup?.id),
    })
    setSubmitting(false)
    setEditMode(false)
  }

  function handleCancel() {
    setEditMode(false)
    const blockerText = existingStandup?.blockers?.trim() ?? ''
    setYesterday(existingStandup?.yesterday_work ?? '')
    setTodayPlans(existingStandup?.today_work ?? '')
    setHasBlocker(Boolean(blockerText))
    setBlockers(blockerText)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="h-6 w-48 rounded-lg bg-slate-200" />
        <div className="h-24 w-full rounded-xl bg-slate-100" />
        <div className="h-24 w-full rounded-xl bg-slate-100" />
        <div className="h-24 w-full rounded-xl bg-slate-100" />
        <div className="h-10 w-32 rounded-xl bg-slate-200" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ring-1 ring-black/[0.04]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">
          {getGreeting()}, {greetingName} 👋
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {existingStandup ? 'Your standup for today' : 'Log your daily standup'}
        </p>
      </div>

      <div className="p-6">
        {existingStandup && !editMode ? (
          /* ── Read view ── */
          <div className="space-y-5">
            {[
              { label: 'Yesterday', value: existingStandup.yesterday_work },
              { label: 'Today', value: existingStandup.today_work },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{value || '—'}</p>
              </div>
            ))}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-500">Blockers</p>
              {existingStandup.blockers?.trim() ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-900">
                    {existingStandup.blockers}
                  </p>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  No blockers
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="mt-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Edit standup
            </button>
          </div>
        ) : (
          /* ── Edit / create form ── */
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200" role="alert">
                {error}
              </p>
            ) : null}

            {[
              { id: 'su-yesterday', label: 'What did you do yesterday?', value: yesterday, setter: setYesterday },
              { id: 'su-today', label: 'What will you do today?', value: todayPlans, setter: setTodayPlans },
            ].map(({ id, label, value, setter }) => (
              <div key={id}>
                <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
                <textarea
                  id={id}
                  required
                  rows={3}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/60"
                />
              </div>
            ))}

            {/* ── Blocker Yes/No toggle ── */}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Any blockers?</p>
              <div className="flex gap-3">
                {[
                  { val: false, label: 'No', color: hasBlocker === false ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400' },
                  { val: true, label: 'Yes', color: hasBlocker === true ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400' },
                ].map(({ val, label, color }) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => handleToggleBlocker(val)}
                    className={`rounded-lg border px-5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${color}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {hasBlocker && (
                <div className="mt-3">
                  <label htmlFor="su-blockers" className="mb-1.5 block text-sm font-medium text-amber-700">
                    Describe the blocker <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="su-blockers"
                    required
                    rows={3}
                    value={blockers}
                    onChange={(e) => setBlockers(e.target.value)}
                    className="block w-full rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-amber-400/60 focus:border-amber-400 focus:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                    placeholder="Describe your blocker…"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {submitting ? (
                  <><Spinner className="h-4 w-4 text-white" /> Saving…</>
                ) : 'Submit standup'}
              </button>
              {existingStandup ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
