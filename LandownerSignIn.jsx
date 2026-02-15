import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LandownerSignIn() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/landowner/dashboard'
  const { signIn } = useAuth()

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  })
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Email and password are required.')
      return
    }
    if (!form.name) {
      setError('Your name is required.')
      return
    }

    signIn({
      role: 'landowner',
      email: form.email,
      name: form.name,
      phone: form.phone || undefined,
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
          Landowner sign in
        </h1>
        <p className="text-puaa-earth/70 text-sm mb-8">
          Register to post properties and connect with verified hunters.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-puaa-earth mb-1.5">Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-puaa-bark/30 bg-white focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
              placeholder="John Smith"
              autoComplete="name"
            />
          </div>
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
            <label className="block text-sm font-medium text-puaa-earth mb-1.5">Phone <span className="text-puaa-earth/50">(optional)</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-puaa-bark/30 bg-white focus:ring-2 focus:ring-puaa-sage focus:border-transparent outline-none"
              placeholder="(555) 123-4567"
              autoComplete="tel"
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

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-puaa-bark hover:bg-puaa-bark/90 text-puaa-cream font-semibold transition"
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
