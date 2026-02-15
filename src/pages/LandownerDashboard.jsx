import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppHeader from '../components/AppHeader'
import MessagesTab from '../components/MessagesTab'
import * as api from '../api'
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || 'AIzaSyDNdQxUwubvJW5QfyX7zpk5cNmYNvoW4QY'
const DEFAULT_CENTER = { lat: 21.3, lng: -157.8 } // Hawaii
const MAP_CONTAINER_STYLE = { width: '100%', height: '280px' }

export default function LandownerDashboard() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [sightings, setSightings] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(tabParam || 'sightings')
  const [addSighting, setAddSighting] = useState({ lat: '', lng: '', seen_at: '', notes: '', count_estimate: '', size_acres: '' })
  const [locating, setLocating] = useState(false)
  const [userLocation, setUserLocation] = useState(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  useEffect(() => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation(null)
      )
    }
  }, [])

  useEffect(() => {
    setActiveTab(tabParam || 'sightings')
  }, [tabParam])

  useEffect(() => {
    load()
  }, [activeTab])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [sightRes, matchesRes] = await Promise.all([
        api.listMySightings({ page: 1, page_size: 100 }),
        api.listMyMatches({ page: 1, page_size: 50 }),
      ])
      setSightings(sightRes)
      setMatches(matchesRes)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSighting = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const lat = parseFloat(addSighting.lat)
      const lng = parseFloat(addSighting.lng)
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !addSighting.seen_at) {
        setError('Valid lat (-90..90), lng (-180..180), and date required.')
        return
      }
      const sizeAcres = parseFloat(addSighting.size_acres)
      if (isNaN(sizeAcres) || sizeAcres <= 0) {
        setError('Property size (acres) is required and must be greater than 0.')
        return
      }
      let seenAt = addSighting.seen_at
      if (!seenAt.includes('T')) seenAt += 'T12:00:00'
      if (typeof seenAt === 'string' && seenAt.length === 16) seenAt += ':00'
      const payload = { lat, lng, seen_at: seenAt }
      if (addSighting.notes?.trim()) payload.notes = addSighting.notes.trim()
      const ce = parseInt(addSighting.count_estimate, 10)
      if (!isNaN(ce) && ce >= 0) payload.count_estimate = ce
      payload.size_acres = sizeAcres
      await api.createSighting(payload)
      setAddSighting({ lat: '', lng: '', seen_at: '', notes: '', count_estimate: '', size_acres: '' })
      setActiveTab('sightings')
      load()
    } catch (err) {
      setError(err.message || 'Failed to add sighting')
    }
  }

  const handleMapClick = (e) => {
    if (!e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    setAddSighting((s) => ({ ...s, lat: String(lat), lng: String(lng) }))
  }

  const handleUseMyLocation = () => {
    if (!navigator?.geolocation) {
      setError('Location is not supported by your browser.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAddSighting((s) => ({ ...s, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }))
        setLocating(false)
      },
      () => {
        setError('Could not get your location. Check permissions or try again.')
        setLocating(false)
      }
    )
  }

  const handleDeleteSighting = async (sightingId) => {
    if (!window.confirm('Delete this sighting? It will no longer appear to hunters.')) return
    setError('')
    try {
      await api.deleteSighting(sightingId)
      load()
    } catch (err) {
      setError(err.message || 'Failed to delete sighting')
    }
  }

  const handleCancelMatch = async (matchId) => {
    setError('')
    try {
      await api.cancelMatch(matchId)
      load()
    } catch (err) {
      setError(err.message || 'Failed to cancel booking')
    }
  }

  const formatDate = (s) => s ? new Date(s).toLocaleString() : '-'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-gray-900">Landowner</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Report pig sightings so hunters in your area can see them. Approve or reject their access requests.</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {['sightings', 'messages', 'bookings'].map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setSearchParams({ tab: t }); }}
              className={`px-4 py-2 text-sm font-medium capitalize transition ${activeTab === t ? 'text-gray-900 border-b-2 border-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}

        {activeTab === 'sightings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border border-gray-200/80 bg-puaa-surface p-6 shadow-lg">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Report a sighting</h2>
              <p className="text-xs text-gray-500 mb-4">Hunters whose subscription area includes this location will see the sighting and can request access to hunt. Approve or reject via Messages in the header.</p>

              <div className="mb-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Click the map to add a pin for the sighting location</p>
                {isLoaded ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200 shadow-lg">
                    <GoogleMap
                      mapContainerStyle={MAP_CONTAINER_STYLE}
                      center={
                        (addSighting.lat && addSighting.lng && !isNaN(parseFloat(addSighting.lat)) && !isNaN(parseFloat(addSighting.lng)))
                          ? { lat: parseFloat(addSighting.lat), lng: parseFloat(addSighting.lng) }
                          : (userLocation || DEFAULT_CENTER)
                      }
                      zoom={12}
                      onClick={handleMapClick}
                      options={{ mapTypeControl: true, streetViewControl: false }}
                    >
                      {addSighting.lat && addSighting.lng && !isNaN(parseFloat(addSighting.lat)) && !isNaN(parseFloat(addSighting.lng)) && (
                        <MarkerF
                          position={{ lat: parseFloat(addSighting.lat), lng: parseFloat(addSighting.lng) }}
                          title="Sighting location"
                        />
                      )}
                    </GoogleMap>
                  </div>
                ) : loadError ? (
                  <p className="text-sm text-amber-600 py-4">Map unavailable. Enter lat/lng manually.</p>
                ) : (
                  <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-puaa-cream text-gray-500 text-sm rounded-lg shadow-inner">
                    Loading map…
                  </div>
                )}
              </div>

              <form onSubmit={handleAddSighting} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={addSighting.lat}
                      onChange={(e) => setAddSighting({ ...addSighting, lat: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="-21.0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={addSighting.lng}
                      onChange={(e) => setAddSighting({ ...addSighting, lng: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="166.0"
                      required
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={locating}
                  className="text-sm font-medium text-gray-700 py-1.5 px-3 rounded-md border border-gray-200/80 bg-puaa-cream hover:bg-puaa-cream/80 disabled:opacity-60 transition"
                >
                  {locating ? 'Getting location…' : 'Use my current location'}
                </button>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Seen at</label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={addSighting.seen_at}
                      onChange={(e) => setAddSighting({ ...addSighting, seen_at: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setAddSighting((s) => ({ ...s, seen_at: new Date().toISOString().slice(0, 16) }))}
                      className="shrink-0 px-3 py-2 text-sm font-medium rounded-md border border-gray-200/80 bg-puaa-cream text-gray-700 hover:bg-puaa-cream/80 transition"
                    >
                      Now
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Property size in acres</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="e.g. 40"
                    value={addSighting.size_acres}
                    onChange={(e) => setAddSighting({ ...addSighting, size_acres: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Count (optional)</label>
                  <input
                    type="number"
                    min="0"
                    value={addSighting.count_estimate}
                    onChange={(e) => setAddSighting({ ...addSighting, count_estimate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={addSighting.notes}
                    onChange={(e) => setAddSighting({ ...addSighting, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
                    rows={2}
                  />
                </div>
                <button type="submit" className="py-2 px-4 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition">
                  Report sighting
                </button>
              </form>
            </div>
            <div className="rounded-lg border border-gray-200/80 bg-puaa-surface overflow-hidden min-h-0 shadow-lg">
              <h2 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-100">My sightings</h2>
              <p className="text-xs text-gray-500 px-4 py-2 bg-puaa-cream/60 border-b border-gray-100">Sightings you reported. Hunters whose area includes these locations see them and can request access.</p>
              {loading ? <p className="p-6 text-sm text-gray-400">Loading…</p> : sightings.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">No sightings yet. Report one above so hunters in that area can request access.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {sightings.map((s) => (
                    <li key={s.id} className="px-4 py-3 flex justify-between items-start gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">#{s.id}</div>
                        <div className="text-xs text-gray-500">{formatDate(s.seen_at)} — ({s.lat}, {s.lng})</div>
                        {s.notes && <p className="text-xs text-gray-600 mt-1">{s.notes}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteSighting(s.id)}
                        className="text-xs text-red-600 hover:underline shrink-0"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
            <p className="text-sm text-gray-500 mb-4">Chat with hunters who requested access to your land. Approve or reject pending requests directly from the conversation.</p>
            <MessagesTab />
          </div>
        )}

        {activeTab === 'bookings' && (
          <div className="rounded-lg border border-gray-200/80 bg-puaa-surface overflow-hidden shadow-lg">
            <h2 className="text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-100">Bookings</h2>
            {loading ? <p className="p-6 text-sm text-gray-400">Loading…</p> : matches.length === 0 ? (
              <p className="p-6 text-sm text-gray-400">No bookings yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {matches.map((m) => (
                  <li key={m.id} className="px-4 py-3 flex justify-between items-start">
                    <div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${m.status === 'confirmed' ? 'bg-puaa-sage/30 text-gray-700' : m.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-puaa-cream text-gray-500'}`}>{m.status}</span>
                      <div className="mt-2 text-sm text-gray-900">Hunter #{m.hunter_user_id}</div>
                      <div className="text-xs text-gray-500">{formatDate(m.start_time)} → {formatDate(m.end_time)}</div>
                    </div>
                    {m.status === 'confirmed' && new Date(m.start_time) > new Date() && (
                      <button onClick={() => handleCancelMatch(m.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
