/**
 * Pua'a API client — integrates with backend per FRONTEND_API_GUIDE.md
 * In dev, Vite proxies /api -> http://localhost:8000 (same-origin, no CORS).
 * In prod, set VITE_API_URL or use relative /api with your server proxy.
 */
const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8000')
const API_PREFIX = BASE_URL ? '' : '/api'

function getToken() {
  return localStorage.getItem('puaa_token')
}

function getHeaders(includeAuth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (includeAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.detail ?? (typeof data === 'string' ? data : res.statusText)
    const err = new Error(msg)
    err.status = res.status
    err.detail = data?.detail
    throw err
  }
  return data
}

// ---------- Auth ----------
export async function register({ name, email, password, role }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/register`, {
    method: 'POST',
    headers: getHeaders(false),
    body: JSON.stringify({ name, email, password, role }),
  })
  return handleResponse(res)
}

export async function login({ email, password }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/login`, {
    method: 'POST',
    headers: getHeaders(false),
    body: JSON.stringify({ email, password }),
  })
  return handleResponse(res)
}

export async function verify2FALogin({ pending_token, code }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/2fa/verify-login`, {
    method: 'POST',
    headers: getHeaders(false),
    body: JSON.stringify({ pending_token, code }),
  })
  return handleResponse(res)
}

export async function get2FAStatus() {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/2fa/status`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function setup2FA() {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/2fa/setup`, { method: 'POST', headers: getHeaders() })
  return handleResponse(res)
}

export async function confirm2FASetup({ code, secret }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/2fa/confirm-setup`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ code, secret }),
  })
  return handleResponse(res)
}

export async function disable2FA({ password }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/auth/2fa/disable`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ password }),
  })
  return handleResponse(res)
}

// ---------- Properties ----------
export async function createProperty(data) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/properties`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function listProperties(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v) })
  const res = await fetch(`${BASE_URL}${API_PREFIX}/properties?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function listMyProperties(params = {}) {
  const q = new URLSearchParams(params)
  const res = await fetch(`${BASE_URL}${API_PREFIX}/properties/mine?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function getProperty(id) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/properties/${id}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function updateProperty(id, data) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/properties/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function listPopularProperties(limit = 10) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/properties/popular?limit=${limit}`, { headers: getHeaders() })
  return handleResponse(res)
}

// ---------- Subscriptions ----------
export async function createSubscription({ center_lat, center_lng, radius_km }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/subscriptions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ center_lat, center_lng, radius_km }),
  })
  return handleResponse(res)
}

export async function listMySubscriptions() {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/subscriptions/mine`, { headers: getHeaders() })
  return handleResponse(res)
}

// ---------- Sightings ----------
export async function createSighting(data) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/sightings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  })
  return handleResponse(res)
}

export async function getSighting(id) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/sightings/${id}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function deleteSighting(id) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/sightings/${id}`, { method: 'DELETE', headers: getHeaders() })
  if (res.status === 204) return
  const data = await res.json().catch(() => ({}))
  const err = new Error(data?.detail ?? res.statusText)
  err.status = res.status
  throw err
}

export async function listMySightings(params = {}) {
  const q = new URLSearchParams(params)
  const res = await fetch(`${BASE_URL}${API_PREFIX}/sightings/mine?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function listSightingsForHunter(params = {}) {
  const q = new URLSearchParams(params)
  const res = await fetch(`${BASE_URL}${API_PREFIX}/sightings/for-hunter?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

// ---------- Access Requests ----------
export async function requestAccess(sightingId, { message } = {}) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/sightings/${sightingId}/request-access`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ message: message ?? '' }),
  })
  return handleResponse(res)
}

export async function listIncomingRequests(params = {}) {
  const q = new URLSearchParams(params)
  const res = await fetch(`${BASE_URL}${API_PREFIX}/requests/incoming?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function approveRequest(requestId, { start_time, end_time, instructions }) {
  // Ensure ISO format (append :00 for seconds if missing)
  let st = start_time
  let et = end_time
  if (typeof st === 'string' && st.length === 16 && !st.includes(':', 14)) st += ':00'
  if (typeof et === 'string' && et.length === 16 && !et.includes(':', 14)) et += ':00'
  const res = await fetch(`${BASE_URL}${API_PREFIX}/requests/${requestId}/approve`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ start_time: st, end_time: et, instructions: instructions ?? '' }),
  })
  return handleResponse(res)
}

export async function rejectRequest(requestId) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/requests/${requestId}/reject`, { method: 'POST', headers: getHeaders() })
  return handleResponse(res)
}

export async function listMyRequests(params = {}) {
  const q = new URLSearchParams(params)
  const res = await fetch(`${BASE_URL}${API_PREFIX}/requests/mine?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

// ---------- Messages (Chat) ----------
export async function listConversations(params = {}) {
  const q = new URLSearchParams(params)
  const res = await fetch(`${BASE_URL}${API_PREFIX}/messages/conversations?${q}`, {
    headers: getHeaders(),
    cache: 'no-store',
  })
  return handleResponse(res)
}

export async function getConversation(requestId) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/messages/conversations/${requestId}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function sendMessage(requestId, { body }) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/messages/conversations/${requestId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ body }),
  })
  return handleResponse(res)
}

export async function deleteConversation(requestId) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/messages/conversations/${requestId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (res.status === 204) return
  const data = await res.json().catch(() => ({}))
  const err = new Error(data?.detail ?? res.statusText)
  err.status = res.status
  throw err
}

// ---------- Matches (Bookings) ----------
export async function listMyMatches(params = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v) })
  const res = await fetch(`${BASE_URL}${API_PREFIX}/matches/mine?${q}`, { headers: getHeaders() })
  return handleResponse(res)
}

export async function cancelMatch(matchId) {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/matches/${matchId}/cancel`, { method: 'POST', headers: getHeaders() })
  return handleResponse(res)
}

// ---------- Stats ----------
export async function getDashboardStats() {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/stats/dashboard`, { headers: getHeaders() })
  return handleResponse(res)
}
