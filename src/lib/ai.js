import { supabase } from './supabase.js'

export async function fetchUserActivityWindow(userId, startDate, endDate) {
  const [su, ta, no] = await Promise.all([
    supabase
      .from('standups')
      .select('standup_date, yesterday_work, today_work, blockers')
      .eq('user_id', userId)
      .gte('standup_date', startDate)
      .lte('standup_date', endDate)
      .order('standup_date', { ascending: false }),
    supabase
      .from('tasks')
      .select('title, status, due_date, task_date')
      .eq('user_id', userId)
      .order('id', { ascending: false }),
    supabase
      .from('notes')
      .select('content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    standups: su.data ?? [],
    tasks: ta.data ?? [],
    notes: no.data ?? [],
    errors: [su.error, ta.error, no.error].filter(Boolean).map(e => e.message),
  }
}

function buildUserPrompt(standups, tasks, notes) {
  const standupsText = standups
    .map(
      (s) =>
        `Date: ${s.standup_date}\nYesterday: ${s.yesterday_work ?? ''}\nToday: ${s.today_work ?? ''}\nBlockers: ${s.blockers ?? ''}`
    )
    .join('\n\n')

  const tasksText = tasks
    .map((t) => `[${t.status}] ${t.title} (due: ${t.due_date || 'none'})`)
    .join('\n')

  const notesText = notes
    .map((n) => `Date: ${n.created_at}\nContent: ${n.content}`)
    .join('\n\n')

  return `You are an AI assistant helping a software engineer review their recent work patterns.

## Standups (last 14 days, newest first)
${standupsText}

## All tasks (status may be todo, in_progress, or done)
${tasksText}

## Recent notes (up to 20, newest first)
${notesText}

Based on this data respond with JSON in exactly this shape:
{
  "summary": string (3 sentences about what this person has been working on),
  "blockers": string[] (list of recurring blockers, empty array if none),
  "trends": string[] (3 work patterns or trends you notice),
  "focus": string[] (2 specific recommended focus areas for this week)
}`
}

export function parseInsightsFromText(text) {
  const match = text.match(/```json\n([\s\S]*?)\n```/)
  const jsonString = match ? match[1] : text
  const parsed = JSON.parse(jsonString)
  if (!parsed.summary || !Array.isArray(parsed.blockers) || !Array.isArray(parsed.trends) || !Array.isArray(parsed.focus)) {
    throw new Error('Invalid JSON shape')
  }
  return parsed
}

export async function generateInsights(data) {
  // TODO: move to Edge Function
  const apiKey = import.meta.env.VITE_GEMINI_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_KEY. Add it to your .env file.')
  }

  const thePrompt = buildUserPrompt(data.standups, data.tasks, data.notes)

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: thePrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    }),
  })

  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = raw?.error?.message || `Request failed (${res.status})`
    throw new Error(msg)
  }

  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || typeof text !== 'string') {
    throw new Error('No text in API response')
  }

  try {
    return parseInsightsFromText(text)
  } catch {
    throw new Error('Could not parse AI response as JSON')
  }
}
