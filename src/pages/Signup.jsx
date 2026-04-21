import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { logger } from '../lib/logger.js'
import { GoogleButton } from '../components/GoogleButton.jsx'
import { Spinner } from '../components/Spinner.jsx'

const inputFocus =
  'focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/80 focus:ring-offset-0'

export default function Signup() {
  const { signUp } = useAuth()
  const showToast = useToast()
  useDocumentTitle('Sign up | Standup Logger')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data, error: signUpError } = await signUp(
      email.trim(),
      password,
      { data: { full_name: fullName.trim() } },
    )
    setSubmitting(false)
    if (signUpError) {
      setError(signUpError.message)
      showToast(signUpError.message, 'error')
      return
    }
    if (data?.user?.id) {
      logger.info('user signed up', { userId: data.user.id })
    }
    setSuccess(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          Standup Logger
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">Create your account</p>

        <div className="mt-8 space-y-6">
          {!success ? (
            <>
              <GoogleButton label="Continue with Google" />

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs font-medium uppercase">
                  <span className="bg-white px-2 text-slate-500">or</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error ? (
                  <p
                    className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Full name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus}`}
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus}`}
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 ${inputFocus}`}
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] active:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Spinner size="sm" className="text-white" />
                      Creating account…
                    </>
                  ) : (
                    'Create account'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900"
              role="status"
            >
              Check your email to confirm your account
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
