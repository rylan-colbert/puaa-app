import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LandownerDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-puaa-cream">
      <header className="bg-puaa-bark text-puaa-cream px-6 py-4 flex items-center justify-between">
        <Link to="/landowner/dashboard" className="font-display font-bold text-lg">Pua'a</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-puaa-cream/80">{user?.email}</span>
          <button onClick={handleSignOut} className="text-sm hover:underline">Sign out</button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-8">
        <h1 className="font-display font-bold text-2xl text-puaa-earth mb-2">Landowner Dashboard</h1>
        <p className="text-puaa-earth/70 mb-6">Property and sighting form coming next.</p>
        <div className="h-64 rounded-xl bg-puaa-sage/20 border border-puaa-bark/20 flex items-center justify-center text-puaa-earth/60">
          Form placeholder
        </div>
      </main>
    </div>
  )
}
