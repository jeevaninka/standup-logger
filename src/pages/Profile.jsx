import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'
import { Spinner } from '../components/Spinner.jsx'
import { IconCamera, IconTrash } from '../components/icons/index.jsx'
import { getInitials } from '../lib/profile.js'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/80 focus:ring-offset-0'

function formatJoinedDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const showToast = useToast()
  const navigate = useNavigate()
  useDocumentTitle('Profile | Standup Logger')

  const avatarInputRef = useRef(null)

  // ── Derived user data ────────────────────────────────────────────────────
  const email = user?.email ?? ''
  const joinedAt = user?.created_at ?? ''
  const meta = user?.user_metadata ?? {}

  // ── Local state ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(meta.full_name ?? meta.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(meta.avatar_url ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Keep local state in sync if auth user refreshes
   
  useEffect(() => {
    const m = user?.user_metadata ?? {}
    setDisplayName(m.full_name ?? m.name ?? '')
    setAvatarUrl(m.avatar_url ?? '')
  }, [user])

  // ── Avatar upload ────────────────────────────────────────────────────────
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const MAX_MB = 2
    if (file.size > MAX_MB * 1024 * 1024) {
      showToast(`Avatar must be under ${MAX_MB} MB`, 'error')
      return
    }

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })
      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      logger.info('avatar updated', { userId: user.id })
      showToast('Avatar updated', 'success')
    } catch (err) {
      showToast(err.message ?? 'Failed to upload avatar', 'error')
    } finally {
      setAvatarUploading(false)
      // Reset input so same file can be re-selected
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    if (!user) return
    setAvatarUploading(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: '' } })
      if (error) throw error
      setAvatarUrl('')
      showToast('Avatar removed', 'success')
    } catch (err) {
      showToast(err.message ?? 'Failed to remove avatar', 'error')
    } finally {
      setAvatarUploading(false)
    }
  }

  // ── Save display name ────────────────────────────────────────────────────
  async function handleSaveProfile(e) {
    e.preventDefault()
    const name = displayName.trim()
    if (!user) return
    setProfileSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
      if (error) throw error
      logger.info('display name updated', { userId: user.id })
      showToast('Profile updated', 'success')
    } catch (err) {
      showToast(err.message ?? 'Failed to update profile', 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Change password ──────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    setPasswordSaving(true)
    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (signInError) throw new Error('Current password is incorrect')

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      logger.info('password changed', { userId: user.id })
      showToast('Password changed successfully', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err.message ?? 'Failed to change password', 'error')
    } finally {
      setPasswordSaving(false)
    }
  }

  // ── Delete account ───────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    if (!window.confirm('This will permanently delete your account and all data. Are you absolutely sure?')) return
    setDeleting(true)
    try {
      // Call an edge function or RPC that deletes the user server-side
      // because supabase.auth.admin.deleteUser requires a service role key
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err) {
      showToast(err.message ?? 'Failed to delete account', 'error')
      setDeleting(false)
    }
  }

  const initials = getInitials(displayName || email)

  return (
    <div className="min-h-full bg-slate-50 p-4 pb-28 md:p-8 md:pb-10">
      <div className="mx-auto max-w-2xl space-y-6">

        <header className="border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your account settings and preferences.</p>
        </header>

        {/* ── Avatar ── */}
        <Section title="Avatar" description="Upload a photo or your initials will be used as a fallback.">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            {/* Avatar display */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Your avatar"
                  className="h-24 w-24 rounded-full object-cover ring-2 ring-slate-200"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 text-2xl font-bold text-white ring-2 ring-slate-200">
                  {initials}
                </div>
              )}
              {avatarUploading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Spinner className="h-6 w-6 text-white" />
                </div>
              ) : null}
            </div>

            {/* Upload controls */}
            <div className="flex flex-col gap-2 text-center sm:text-left">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
                aria-label="Upload avatar"
              />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-60"
              >
                <IconCamera className="h-4 w-4" />
                {avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarUrl ? (
                <button
                  type="button"
                  disabled={avatarUploading}
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 disabled:opacity-60"
                >
                  <IconTrash className="h-4 w-4" />
                  Remove photo
                </button>
              ) : null}
              <p className="text-xs text-slate-400">PNG, JPG, WEBP or GIF · max 2 MB</p>
            </div>
          </div>
        </Section>

        {/* ── Profile info ── */}
        <Section title="Profile" description="Update your display name shown across the app.">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-slate-700">
                Display name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 shadow-sm cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-400">Email cannot be changed here.</p>
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {profileSaving ? <Spinner className="h-4 w-4 text-white" /> : null}
                Save changes
              </button>
            </div>
          </form>
        </Section>

        {/* ── Account info ── */}
        <Section title="Account info" description="Read-only details about your account.">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 truncate text-sm font-medium text-slate-900">{email || '—'}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900">{formatJoinedDate(joinedAt)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">User ID</dt>
              <dd className="mt-1 truncate font-mono text-xs text-slate-500">{user?.id ?? '—'}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Provider</dt>
              <dd className="mt-1 text-sm font-medium text-slate-900 capitalize">
                {user?.app_metadata?.provider ?? 'email'}
              </dd>
            </div>
          </dl>
        </Section>

        {/* ── Change password ── */}
        <Section title="Change password" description="Must be at least 8 characters.">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
                Current password
              </label>
              <input
                id="current-password"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="new-password"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm ${inputFocus}`}
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword ? (
                <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="show-passwords"
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <label htmlFor="show-passwords" className="text-sm text-slate-600 select-none cursor-pointer">
                Show passwords
              </label>
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={
                  passwordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {passwordSaving ? <Spinner className="h-4 w-4 text-white" /> : null}
                Update password
              </button>
            </div>
          </form>
        </Section>

        {/* ── Danger zone ── */}
        <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm ring-1 ring-red-100">
          <div className="mb-5 border-b border-red-100 pb-4">
            <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
            <p className="mt-1 text-sm text-slate-500">
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-700">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className={`mt-1 block w-full rounded-lg border border-red-200 px-3 py-2 text-slate-900 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300/80 focus:ring-offset-0`}
              />
            </div>
            <button
              type="button"
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              onClick={handleDeleteAccount}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.99] active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? <Spinner className="h-4 w-4 text-white" /> : <IconTrash className="h-4 w-4" />}
              Delete my account
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}