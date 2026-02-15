import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'puaa_token'
const USER_KEY = 'puaa_user'

function loadStored() {
  const token = localStorage.getItem(TOKEN_KEY)
  const userStr = localStorage.getItem(USER_KEY)
  let user = null
  try {
    if (userStr) user = JSON.parse(userStr)
  } catch (_) {}
  return { token, user }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const { token: t, user: u } = loadStored()
    if (t && u) {
      setToken(t)
      setUser(u)
    }
    setIsLoading(false)
  }, [])

  function persist(t, u) {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_KEY)
    setToken(t)
    setUser(u)
  }

  async function register(data) {
    const { user: u, token: t } = await api.register(data)
    persist(t, u)
    return { user: u, token: t }
  }

  async function login(data) {
    const res = await api.login(data)
    if (res.requires_2fa) {
      return { requires_2fa: true, pending_token: res.pending_token, message: res.message }
    }
    persist(res.token, res.user)
    return { user: res.user, token: res.token }
  }

  async function verify2FA(pendingToken, code) {
    const res = await api.verify2FALogin({ pending_token: pendingToken, code })
    persist(res.token, res.user)
    return { user: res.user, token: res.token }
  }

  function signOut() {
    persist(null, null)
  }

  const value = {
    user,
    token,
    isLoading,
    register,
    login,
    verify2FA,
    signOut,
    get2FAStatus: api.get2FAStatus,
    setup2FA: api.setup2FA,
    confirm2FASetup: api.confirm2FASetup,
    disable2FA: api.disable2FA,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
