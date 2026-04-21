import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState.jsx'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'
import { Spinner } from '../components/Spinner.jsx'
import { formatRelativeTime, isoToLocalDateKey } from '../lib/date.js'
import { IconDocument, IconTrash, IconPencil } from '../components/icons/index.jsx'
import { encryptNote, decryptNote } from '../lib/crypto.js'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:ring-offset-0'

// ── NoteItem: handles its own edit state ──────────────────────────────────────
function NoteItem({ note, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content ?? '')
  const [saving, setSaving] = useState(false)

  // Sync if parent updates note externally
   
  useEffect(() => {
    if (!editing) setEditContent(note.content ?? '')
  }, [note.content, editing])

  function handleEditOpen() {
    setEditContent(note.content ?? '')
    setEditing(true)
  }

  function handleEditCancel() {
    setEditing(false)
  }

  async function handleEditSave() {
    const content = editContent.trim()
    if (!content) return
    setSaving(true)
    await onEdit(note, content)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit note</p>
          <textarea
            autoFocus
            rows={3}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm ${inputFocus} resize-none`}
            placeholder="Edit your note…"
          />
        <p className="mt-1 text-xs text-slate-400">Ctrl+Enter to save · Esc to cancel</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={saving || !editContent.trim()}
            onClick={handleEditSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
          >
            {saving ? <Spinner className="h-3.5 w-3.5 text-white" /> : null}
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
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-slate-900">{note.content ?? ''}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <time
              className="text-xs text-slate-500"
              dateTime={note.created_at}
              title={new Date(note.created_at).toLocaleString()}
            >
              {formatRelativeTime(note.created_at)}
            </time>
            {note.standup_id ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 ring-1 ring-blue-200">
                Linked to standup
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleEditOpen}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-0"
            aria-label="Edit note"
          >
            <IconPencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
            aria-label="Delete note"
          >
            <IconTrash className="h-5 w-5" />
          </button>
        </div>
      </div>
    </li>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Notes() {
  const { user } = useAuth()
  const showToast = useToast()
  useDocumentTitle('Notes | Standup Logger')
  const userId = user?.id

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')  // NEW
  const [error, setError] = useState('')

  const loadNotes = useCallback(async () => {
    if (!userId) return
    const { data, error: fetchError } = await supabase
      .from('notes')
      .select('id, content, created_at, standup_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError.message)
      setNotes([])
      return
    }
    // Decrypt all notes
    const decrypted = await Promise.all(
      (data ?? []).map(async (n) => ({ ...n, content: await decryptNote(n.content) }))
    )
    setError('')
    setNotes(decrypted)
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await loadNotes()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, loadNotes])

  const filteredNotes = useMemo(() => {
    let result = notes
    // Text search filter
    const q = search.trim().toLowerCase()
    if (q) result = result.filter((n) => (n.content ?? '').toLowerCase().includes(q))
    // Date filter — match notes whose created_at falls on the selected local date
    if (dateFilter) result = result.filter((n) => isoToLocalDateKey(n.created_at) === dateFilter)
    return result
  }, [notes, search, dateFilter])

  async function handleSave(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || !userId) return
    setSaving(true)
    const encryptedContent = await encryptNote(content)
    const { data, error: insertError } = await supabase
      .from('notes')
      .insert({ user_id: userId, content: encryptedContent })
      .select('id, content, created_at, standup_id')
      .single()
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      showToast(insertError.message, 'error')
      return
    }
    if (data) {
      logger.info('note saved', { userId })
      // Store decrypted version locally so UI shows plaintext immediately
      setNotes((prev) => [{ ...data, content }, ...prev])
      setDraft('')
      setError('')
      showToast('Note saved', 'success')
    }
  }

  async function handleDelete(note) {
    if (!window.confirm('Delete this note? This cannot be undone.')) return
    const { error: delError } = await supabase.from('notes').delete().eq('id', note.id).eq('user_id', userId)
    if (delError) {
      setError(delError.message)
      return
    }
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    setError('')
  }

  // ── NEW: inline edit save ─────────────────────────────────────────────────
  async function handleEdit(note, content) {
    const encryptedContent = await encryptNote(content)
    const { error: updateError } = await supabase
      .from('notes')
      .update({ content: encryptedContent })
      .eq('id', note.id)
      .eq('user_id', userId)
    if (updateError) {
      setError(updateError.message)
      showToast(updateError.message, 'error')
      return
    }
    logger.info('note edited', { userId, noteId: note.id })
    showToast('Note updated', 'success')
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, content } : n)))
    setError('')
  }
  // ─────────────────────────────────────────────────────────────────────────

  const hasFilters = search.trim() || dateFilter

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 md:p-8 md:pb-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notes</h1>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSave} className="mt-8">
          <label htmlFor="note-draft" className="sr-only">
            Capture a thought
          </label>
          <textarea
            id="note-draft"
            rows={6}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`block w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus} resize-none`}
            placeholder="What's on your mind?"
          />
          <div className="mt-3 flex justify-stretch sm:justify-end">
            <button
              type="submit"
              disabled={saving || !draft.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? <Spinner className="h-4 w-4 text-white" /> : null}
              Save
            </button>
          </div>
        </form>

        <div className="mt-12 border-t border-slate-200 pt-8">
          {/* ── Filters row ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="note-search" className="block text-sm font-medium text-slate-700">
                Search notes
              </label>
              <input
                id="note-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by content…"
                className={`mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ${inputFocus}`}
              />
            </div>
            <div>
              <label htmlFor="note-date" className="block text-sm font-medium text-slate-700">
                Filter by date
              </label>
              <div className="relative mt-1 flex items-center gap-2">
                <input
                  id="note-date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className={`block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ${inputFocus}`}
                />
                {dateFilter ? (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                    aria-label="Clear date filter"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {loading ? (
            <ul className="mt-6 space-y-4">
              {[1, 2, 3].map((k) => (
                <li key={k} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="h-4 max-w-[75%] rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-4 max-w-[85%] rounded bg-slate-100" />
                </li>
              ))}
            </ul>
          ) : notes.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<IconDocument className="mx-auto" />}
                title="No notes yet — capture a thought"
                description="Use the box above to save a quick note. It will show up here."
              />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                title="No notes match your filters"
                description={
                  hasFilters
                    ? 'Try a different keyword or date, or clear the filters.'
                    : 'Try a different keyword or clear the search box.'
                }
              />
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {filteredNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}