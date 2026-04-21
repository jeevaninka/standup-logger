import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { logger } from '../lib/logger.js'
import { Spinner } from '../components/Spinner.jsx'
import { localDateKey, formatMinutesAgo } from '../lib/date.js'
import { IconInsights, IconBolt, IconDocument } from '../components/icons/index.jsx'
import { fetchUserActivityWindow, generateInsights } from '../lib/ai.js'

function startDateForLastNDays(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateKey(d)
}

function SkeletonCards() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {[1, 2, 3, 4].map((k) => (
        <div
          key={k}
          className="animate-pulse rounded-xl border border-slate-200/80 p-6 shadow-sm ring-1 ring-slate-100"
        >
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-full rounded bg-slate-100" />
          <div className="mt-2 h-4 max-w-[85%] rounded bg-slate-100" />
          <div className="mt-2 h-4 max-w-[66%] rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

export default function Insights() {
  const { user } = useAuth()
  const showToast = useToast()
  useDocumentTitle('Insights | Standup Logger')
  const userId = user?.id

  const [dataLoading, setDataLoading] = useState(true)
  const [standups, setStandups] = useState([])
  const [dataError, setDataError] = useState('')

  const [insights, setInsights] = useState(null)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [lastGenerated, setLastGenerated] = useState(null)
  const [, setTick] = useState(0)

  const endDate = useMemo(() => localDateKey(), [])
  const startDate = useMemo(() => startDateForLastNDays(14), [])

  const loadActivity = useCallback(async () => {
    if (!userId) return
    const { standups: su, errors } = await fetchUserActivityWindow(userId, startDate, endDate)
    setDataError(errors.length ? errors.join(' · ') : '')
    setStandups(su)
  }, [userId, startDate, endDate])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await loadActivity()
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, loadActivity])

  useEffect(() => {
    if (!lastGenerated) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [lastGenerated])

  const standupCount = standups.length
  const canGenerate = standupCount >= 3

  const runGeneration = useCallback(async () => {
    if (!userId) return
    setApiError('')
    setApiLoading(true)
    
    const data = await fetchUserActivityWindow(userId, startDate, endDate)
    setStandups(data.standups)
    
    if (data.errors.length) {
      setDataError(data.errors.join(' · '))
    } else {
      setDataError('')
    }

    if (data.standups.length < 3) {
      setApiLoading(false)
      setApiError('')
      showToast('Need at least 3 standups in the last 14 days to generate insights.', 'warning')
      return
    }

    try {
      const parsed = await generateInsights(data)
      setApiError('')
      setInsights(parsed)
      setLastGenerated(Date.now())
      logger.info('insights generated', { userId })
      showToast('Insights generated', 'success')
    } catch (e) {
      logger.error('insights failed', {
        error: e instanceof Error ? e.message : String(e),
      })
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setApiError(msg)
      showToast(msg, 'error')
    } finally {
      setApiLoading(false)
    }
  }, [userId, startDate, endDate, showToast])

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 md:p-8 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Insights</h1>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {lastGenerated ? (
              <p className="text-sm text-slate-600">Last generated: {formatMinutesAgo(lastGenerated)}</p>
            ) : null}
            {canGenerate && !dataLoading ? (
              <button
                type="button"
                onClick={() => {
                  void runGeneration()
                }}
                disabled={apiLoading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60 sm:w-auto"
              >
                {apiLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" className="text-white" /> Analyzing…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <IconBolt className="h-4 w-4" /> Generate Insights
                  </span>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {dataError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{dataError}</p>
        ) : null}
        {apiError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{apiError}</p>
        ) : null}

        {dataLoading ? (
          <SkeletonCards />
        ) : !canGenerate ? (
          <div className="mt-8">
            <EmptyState
              icon={<IconDocument className="mx-auto" />}
              title="Not enough data yet"
              description={`You have ${standupCount} standup${standupCount === 1 ? '' : 's'} in the last 14 days. Generate insights once you have at least 3.`}
            />
          </div>
        ) : !insights && !apiLoading ? (
          <div className="mt-8">
            <EmptyState
              icon={<IconInsights className="mx-auto" />}
              title="Ready to generate"
              description="Click the button above to analyze your recent standups, tasks, and notes."
            />
          </div>
        ) : apiLoading && !insights ? (
          <SkeletonCards />
        ) : insights ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-indigo-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100">
                  <IconInsights className="h-4 w-4 text-indigo-700" />
                </span>
                Summary
              </h2>
              <p className="leading-relaxed text-slate-700">{insights.summary}</p>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-600">Recurring Blockers</h2>
              {insights.blockers.length === 0 ? (
                <p className="text-sm italic text-slate-400">No recurring blockers detected.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {insights.blockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">Focus Areas</h2>
              {insights.focus.length === 0 ? (
                <p className="text-sm italic text-slate-400">No specific focus recommended.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {insights.focus.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:col-span-2">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">Work Trends</h2>
              {insights.trends.length === 0 ? (
                <p className="text-sm italic text-slate-400">No notable trends detected.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700">
                  {insights.trends.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      <span className="leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
