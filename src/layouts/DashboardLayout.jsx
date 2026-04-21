import { createElement, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getInitials } from '../lib/profile.js'
import { supabase } from '../lib/supabase.js'
import {
  IconToday,
  IconTasks,
  IconNotes,
  IconInsights,
  IconHistory,
  IconProfile,
  IconBolt,
} from '../components/icons/index.jsx'

const navItems = [
  { to: '/dashboard/today', label: 'Today', icon: IconToday },
  { to: '/dashboard/tasks', label: 'My Tasks', icon: IconTasks },
  { to: '/dashboard/notes', label: 'Notes', icon: IconNotes },
  { to: '/dashboard/insights', label: 'Insights', icon: IconInsights },
  { to: '/dashboard/history', label: 'History', icon: IconHistory },
  { to: '/dashboard/profile', label: 'Profile', icon: IconProfile },
]

function navClass(isActive) {
  return [
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:ring-offset-2 focus:ring-offset-slate-950 border-l-2',
    isActive
      ? 'bg-indigo-500/20 text-indigo-300 shadow-inner border-indigo-400'
      : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100',
  ].join(' ')
}

function NavItems({ compact }) {
  return (
    <>
      {navItems.map(({ to, label, icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => navClass(isActive)} end>
          {createElement(icon, {
            className: compact ? 'h-6 w-6 shrink-0' : 'h-5 w-5 shrink-0',
          })}
          {!compact ? <span>{label}</span> : <span className="sr-only">{label}</span>}
        </NavLink>
      ))}
    </>
  )
}

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfile(data)
    })
  }, [user?.id])

  const meta = user?.user_metadata ?? {}
  const displayName = profile?.full_name || meta.full_name || meta.name || user?.email || ''
  const avatarUrl = profile?.avatar_url || meta.avatar_url || ''
  const avatarInitials = getInitials(displayName, user?.email || '')

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-slate-100 md:flex">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-lg shadow-indigo-500/30">
            <IconBolt className="h-5 w-5 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white">Standup Logger</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          <NavItems compact={false} />
        </nav>

        {/* Footer: profile + sign out */}
        <div className="border-t border-white/[0.06] p-3">
          <NavLink
            to="/dashboard/profile"
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-xl px-3 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:ring-offset-2 focus:ring-offset-slate-950',
                isActive ? 'bg-indigo-500/20' : 'hover:bg-white/5',
              ].join(' ')
            }
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Your avatar"
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white ring-2 ring-white/10">
                {avatarInitials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{displayName || 'Account'}</p>
              <p className="text-xs text-slate-500">View profile</p>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex min-h-screen flex-1 flex-col pb-20 md:pb-0">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-white/[0.06] bg-slate-950 px-1 py-2 md:hidden"
        aria-label="Primary"
      >
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition focus:outline-none',
                isActive ? 'text-indigo-300' : 'text-slate-500 hover:text-slate-300',
              ].join(' ')
            }
            end
          >
            {({ isActive }) =>
              to === '/dashboard/profile' && avatarUrl ? (
                <>
                  <img
                    src={avatarUrl}
                    alt=""
                    className={`h-6 w-6 rounded-full object-cover ${isActive ? 'ring-2 ring-indigo-400' : 'ring-1 ring-white/10'}`}
                  />
                  <span>{label}</span>
                </>
              ) : (
                <>
                  {createElement(icon, { className: 'h-6 w-6' })}
                  <span>{label}</span>
                </>
              )
            }
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
