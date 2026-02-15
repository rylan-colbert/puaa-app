import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HunterSignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/hunter/dashboard'
  const { signIn } = useAuth()

  const [form, setForm] = useState({
    email: '',
    password: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiry: '',
  })
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Email and password are required.')
      return
    }
    if (!form.licenseNumber || !form.licenseState || !form.licenseExpiry) {
      setError('Hunting license details are required.')
      return
    }

    signIn({
      role: 'hunter',
      email: form.email,
      licenseNumber: form.licenseNumber,
      licenseState: form.licenseState,
      licenseExpiry: form.licenseExpiry,
    })
    navigate(redirect)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-puaa-cream">
      <Link to="/" className="absolute top-6 left-6 font-display font-bold text-puaa-earth hover:opacity-80">
        ← Pua'a
      </Link>
      <div className="w-full max-w-md">
        <h1 className="font-display font-bold text-2xl text-puaa-earth mb-1">
          Hunter sign in
        </h1>
        <p className="text-puaa-earth/70 text-sm mb-8">
          We require a valid hunting license to connect you with landowners.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-puaa-earth mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-puaa-bark/30 bg-white focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-puaa-earth mb-1.5">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-puaa-bark/30 bg-white focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="pt-2 border-t border-puaa-bark/20">
            <p className="text-sm font-medium text-puaa-earth mb-3">Hunting license</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-puaa-earth/70 mb-1">License number</label>
                <input
                  type="text"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-puaa-bark/30 bg-white text-sm focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
                  placeholder="e.g. 12345678"
                />
              </div>
              <div>
                <label className="block text-xs text-puaa-earth/70 mb-1">State</label>
                <input
                  type="text"
                  value={form.licenseState}
                  onChange={(e) => setForm({ ...form, licenseState: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-puaa-bark/30 bg-white text-sm focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-xs text-puaa-earth/70 mb-1">Expiry date</label>
                <input
                  type="date"
                  value={form.licenseExpiry}
                  onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-puaa-bark/30 bg-white text-sm focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-puaa-forest hover:bg-puaa-forest/90 text-puaa-cream font-semibold transition"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-puaa-earth/70">
          <Link to="/signin" className="hover:underline">Choose a different role</Link>
        </p>
      </div>
    </div>
  )
}
