import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'

export default function AppHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)

  const handleSignOut = () => {
    signOut()
    navigate('/')
  }

  const baseUrl = user?.role === 'hunter' ? '/hunter' : '/landowner'
  const messagesUrl = `${baseUrl}/dashboard?tab=messages`

  return (
    <header className="shrink-0 border-b border-gray-200 bg-gradient-to-b from-white to-puaa-surface/90 backdrop-blur-md">
      <div className="flex items-center justify-between w-full px-6 py-4">
        <Link to={user ? `${baseUrl}/dashboard` : '/'} className="font-display text-lg font-semibold text-gray-900 tracking-tight shrink-0">
          Pua'a
        </Link>
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link to={messagesUrl} className="text-base text-gray-600 hover:text-gray-900 transition">
                Messages
              </Link>
              <div className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="text-base text-gray-600 hover:text-gray-900 transition"
                >
                  Profile
                </button>
                {showProfile && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} aria-hidden />
                    <div className="absolute right-0 top-full mt-2 py-2 w-52 bg-puaa-surface rounded-lg border border-gray-200/80 shadow-sm z-20">
                      <div className="px-4 py-2 text-base text-gray-900 font-medium">{user?.name}</div>
                      <div className="px-4 py-1 text-sm text-gray-500">{user?.email}</div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 mt-2 pt-2 text-base text-gray-600 hover:bg-puaa-cream/50 border-t border-gray-100"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/hunter/signin" className="text-base text-gray-600 hover:text-gray-900 transition">
                Hunter
              </Link>
              <Link to="/landowner/signin" className="text-base text-gray-600 hover:text-gray-900 transition">
                Landowner
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
