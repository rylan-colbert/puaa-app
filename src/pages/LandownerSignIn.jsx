import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LandownerSignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/landowner/dashboard'
  const { register, login, verify2FA } = useAuth()

  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [twoFA, setTwoFA] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!form.name?.trim() || !form.email?.trim() || !form.password) {
        setError('Name, email, and password are required.')
        return
      }
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: 'landowner' })
      navigate(redirect)
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!form.email?.trim() || !form.password) {
        setError('Email and password are required.')
        return
      }
      const res = await login({ email: form.email.trim(), password: form.password })
      if (res.requires_2fa) {
        setTwoFA({ pending_token: res.pending_token, message: res.message })
      } else {
        navigate(redirect)
      }
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        setError('Enter a valid 6-digit code.')
        return
      }
      await verify2FA(twoFA.pending_token, code)
      navigate(redirect)
    } catch (err) {
      setError(err.message || 'Invalid code.')
    } finally {
      setLoading(false)
    }
  }

  if (twoFA) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <Link to="/" className="absolute top-6 left-6 text-sm font-medium text-gray-600 hover:text-gray-900">
          ← Pua'a
        </Link>
        <div className="w-full max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Two-factor verification</h1>
          <p className="text-gray-500 text-sm mb-6">{twoFA.message}</p>
          <form onSubmit={handleVerify2FA} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400 text-center text-lg tracking-widest"
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setTwoFA(null); setCode(''); setError(''); }}
            className="mt-4 w-full text-sm text-gray-500 hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <Link to="/" className="absolute top-6 left-6 text-sm font-medium text-gray-600 hover:text-gray-900">
        ← Pua'a
      </Link>
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Landowner {mode === 'login' ? 'sign in' : 'register'}</h1>
        <p className="text-gray-500 text-sm mb-8">
          {mode === 'login' ? 'Sign in to manage properties and sightings.' : 'Register to post properties and connect with hunters.'}
        </p>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-5">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Full name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="John Smith"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && <p className="text-xs text-gray-400 mt-1">At least 8 characters</p>}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-60"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>Don&apos;t have an account?{' '}
              <button type="button" onClick={() => { setMode('register'); setError(''); }} className="hover:underline font-medium">Register</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(''); }} className="hover:underline font-medium">Sign in</button>
            </>
          )}
        </p>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/signin" className="hover:underline">Choose a different role</Link>
        </p>
      </div>
    </div>
  )
}
