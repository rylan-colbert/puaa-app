import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppHeader from '../components/AppHeader'
import MessagesTab from '../components/MessagesTab'
import * as api from '../api'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || 'AIzaSyDNdQxUwubvJW5QfyX7zpk5cNmYNvoW4QY'
const DEFAULT_CENTER = { lat: 21.3, lng: -157.8 } // Hawaii
const MAP_CONTAINER_STYLE = { width: '100%', height: '560px' }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function HunterDashboard() {
  const { user } = useAuth()
  const location = useLocation()
  const [properties, setProperties] = useState([])
  const [matches, setMatches] = useState([])
  const [sightings, setSightings] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [map, setMap] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(tabParam || 'map')
  const [selectedPin, setSelectedPin] = useState(null) // { type, position, data }
  const [requestingPropertyId, setRequestingPropertyId] = useState(null)
  const [requestSentPropertyId, setRequestSentPropertyId] = useState(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [propsRes, matchesRes, sightRes] = await Promise.all([
        api.listProperties({ page: 1, page_size: 100 }),
        api.listMyMatches({ page: 1, page_size: 50 }),
        api.listSightingsForHunter({ page: 1, page_size: 100 }),
      ])
      setProperties(Array.isArray(propsRes) ? propsRes : [])
      setMatches(Array.isArray(matchesRes) ? matchesRes : [])
      setSightings(Array.isArray(sightRes) ? sightRes : [])
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setActiveTab(tabParam || 'map')
  }, [tabParam])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!navigator?.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    )
  }, [])

  const propertyIdsWithSightings = new Set(sightings.map((s) => Number(s.property_id)))
  const listingsWithDistance = properties
    .filter((p) => p.lat != null && p.lng != null && propertyIdsWithSightings.has(Number(p.id)))
    .map((p) => ({
      ...p,
      distanceKm: userLocation ? haversineKm(userLocation.lat, userLocation.lng, p.lat, p.lng) : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))

  const currentBookings = matches.filter((m) => m.status === 'confirmed')
  const confirmedBookings = currentBookings.filter((m) => new Date(m.start_time) > new Date())

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance)
  }, [])

  const formatDate = (s) => (s ? new Date(s).toLocaleString() : '-')

  const getFirstSightingForProperty = (propertyId) =>
    sightings.find((s) => Number(s.property_id) === Number(propertyId))

  const handleRequestAccess = async (propertyId) => {
    const sighting = getFirstSightingForProperty(propertyId)
    if (!sighting) {
      setError('Could not find sighting for this property. Try refreshing the page.')
      return
    }
    setRequestingPropertyId(propertyId)
    setError('')
    try {
      await api.requestAccess(sighting.id, {
        message: 'I\'d like to request access to hunt on your property.',
      })
      setRequestSentPropertyId(propertyId)
      setTimeout(() => setRequestSentPropertyId(null), 4000)
      load()
      setSelectedPin(null)
      setActiveTab('bookings')
      setSearchParams({ tab: 'bookings' })
    } catch (err) {
      setError(err.message || 'Failed to send request')
    } finally {
      setRequestingPropertyId(null)
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

  if (loadError) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-base text-red-600">Failed to load Google Maps: {loadError.message}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Hunter Dashboard</h1>
        <p className="text-base text-gray-500 mt-1 mb-4">View listings on the map, browse by distance, and manage your bookings.</p>

        {error && <p className="mb-4 text-red-600 text-base">{error}</p>}
        {(requestSentPropertyId || location.state?.requestSent) && (
          <p className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-base">
            Request sent! The landowner will review and can approve or reject. Check Messages or Bookings for updates.
          </p>
        )}

        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {['map', 'listings', 'messages', 'bookings'].map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setSearchParams({ tab: t }); }}
              className={`px-4 py-2 text-base font-medium capitalize transition ${activeTab === t ? 'text-gray-900 border-b-2 border-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Map */}
        {activeTab === 'map' && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Map</h2>
          <div className="rounded-xl overflow-hidden border border-gray-200/80 bg-puaa-surface shadow-xl">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={userLocation || DEFAULT_CENTER}
                zoom={userLocation ? 10 : 8}
                onLoad={onMapLoad}
                options={{ mapTypeControl: true, streetViewControl: false }}
              >
                {userLocation && (
                  <MarkerF
                    position={userLocation}
                    title="You are here"
                    onClick={() => setSelectedPin({ type: 'user', position: userLocation })}
                    zIndex={1000}
                    icon={{
                      path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
                      scale: 12,
                      fillColor: '#2563eb',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 3,
                    }}
                  />
                )}
                {listingsWithDistance.map((p) => (
                  <MarkerF
                    key={p.id}
                    position={{ lat: p.lat, lng: p.lng }}
                    title={p.name || `Property #${p.id}`}
                    onClick={() => setSelectedPin({ type: 'property', position: { lat: p.lat, lng: p.lng }, data: p })}
                  />
                ))}
                {selectedPin && (
                  <InfoWindowF
                    position={selectedPin.position}
                    onCloseClick={() => setSelectedPin(null)}
                  >
                    <div className="p-2 min-w-[200px] max-w-[280px]">
                      {selectedPin.type === 'user' && (
                        <>
                          <div className="font-semibold text-gray-900">You are here</div>
                          <p className="text-sm text-gray-600 mt-1">Your current location</p>
                        </>
                      )}
                      {selectedPin.type === 'property' && selectedPin.data && (
                        <>
                          <div className="font-semibold text-gray-900">{selectedPin.data.name || `Property #${selectedPin.data.id}`}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {selectedPin.data.lat?.toFixed(4)}, {selectedPin.data.lng?.toFixed(4)}
                            {selectedPin.data.island && ` • ${selectedPin.data.island}`}
                          </div>
                          {selectedPin.data.notes && <p className="text-sm text-gray-600 mt-1">{selectedPin.data.notes}</p>}
                          {selectedPin.data.daily_rate != null && selectedPin.data.daily_rate > 0 && (
                            <p className="text-sm text-gray-600 mt-0.5">${selectedPin.data.daily_rate}/day</p>
                          )}
                          {selectedPin.data.size_acres != null && selectedPin.data.size_acres > 0 && (
                            <p className="text-sm text-gray-600 mt-0.5">{selectedPin.data.size_acres} acres</p>
                          )}
                          {selectedPin.data.max_hunters != null && selectedPin.data.max_hunters > 0 && (
                            <p className="text-sm text-gray-600 mt-0.5">Hunting area: up to {selectedPin.data.max_hunters} hunters</p>
                          )}
                          {selectedPin.data.distanceKm != null && (
                            <p className="text-sm font-medium text-gray-700 mt-1">{selectedPin.data.distanceKm.toFixed(1)} km from you</p>
                          )}
                          {(() => {
                            const booking = matches.find((m) => m.property_id === selectedPin.data.id && m.status === 'confirmed' && new Date(m.start_time) > new Date())
                            const isRequesting = requestingPropertyId === selectedPin.data.id
                            return (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                {booking && (
                                  <div className="mb-3">
                                    <div className="text-xs font-medium text-green-700 uppercase tracking-wide">Your booking</div>
                                    <div className="text-sm text-gray-700 mt-1">{formatDate(booking.start_time)} → {formatDate(booking.end_time)}</div>
                                    {booking.instructions && <p className="text-xs text-gray-600 mt-0.5">{booking.instructions}</p>}
                                  </div>
                                )}
                                {!booking && (
                                  <>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleRequestAccess(selectedPin.data.id) }}
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                                      disabled={isRequesting}
                                      className="block w-full py-2 px-3 text-center text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 transition"
                                    >
                                      {isRequesting ? 'Sending…' : 'Book'}
                                    </button>
                                    <Link
                                      to={`/hunter/book/${selectedPin.data.id}`}
                                      className="block w-full py-1.5 mt-2 text-center text-xs text-gray-600 hover:underline"
                                    >
                                      Book with message →
                                    </Link>
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </>
                      )}
                    </div>
                  </InfoWindowF>
                )}
              </GoogleMap>
            ) : (
              <div style={MAP_CONTAINER_STYLE} className="flex items-center justify-center bg-puaa-cream text-gray-500 text-base shadow-inner">
                Loading map…
              </div>
            )}
          </div>
        </section>
        )}

        {/* Listings */}
        {activeTab === 'listings' && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Listings
            {userLocation && <span className="text-base font-normal text-gray-500 ml-2">(sorted by distance from you)</span>}
          </h2>
          <div className="rounded-xl border border-gray-200/80 bg-puaa-surface overflow-hidden shadow-lg">
            {loading ? (
              <p className="p-6 text-base text-gray-400">Loading…</p>
            ) : listingsWithDistance.length === 0 ? (
              <p className="p-6 text-base text-gray-500">No properties with pig sightings in your area yet. Subscribe to more areas or check back when landowners report sightings.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {listingsWithDistance.map((p) => (
                  <li key={p.id} className="px-4 py-4 flex justify-between items-start gap-4">
                    <div>
                      <div className="text-base font-medium text-gray-900">{p.name || `Property #${p.id}`}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        ({p.lat?.toFixed(4)}, {p.lng?.toFixed(4)})
                        {p.island && ` • ${p.island}`}
                      </div>
                      {p.notes && <p className="text-sm text-gray-600 mt-1">{p.notes}</p>}
                      {p.daily_rate != null && p.daily_rate > 0 && (
                        <p className="text-sm text-gray-500 mt-0.5">${p.daily_rate}/day</p>
                      )}
                      {p.size_acres != null && p.size_acres > 0 && (
                        <p className="text-sm text-gray-500 mt-0.5">{p.size_acres} acres</p>
                      )}
                      {p.max_hunters != null && p.max_hunters > 0 && (
                        <p className="text-sm text-gray-500 mt-0.5">Hunting area: up to {p.max_hunters} hunters</p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {p.distanceKm != null ? (
                        <span className="text-base font-medium text-gray-700">{p.distanceKm.toFixed(1)} km away</span>
                      ) : (
                        <span className="text-sm text-gray-400">Enable location for distance</span>
                      )}
                      <>
                      <button
                        type="button"
                        onClick={() => handleRequestAccess(p.id)}
                        disabled={requestingPropertyId === p.id}
                        className="py-2 px-4 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 transition"
                      >
                        {requestingPropertyId === p.id ? 'Sending…' : 'Book'}
                      </button>
                      <Link
                        to={`/hunter/book/${p.id}`}
                        className="block text-xs text-gray-600 hover:underline mt-1"
                      >
                        Add message →
                      </Link>
                    </>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        )}

        {/* Messages */}
        {activeTab === 'messages' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Messages</h2>
          <p className="text-base text-gray-500 mb-4">Message landowners about properties you&apos;re interested in.</p>
          <MessagesTab />
        </section>
        )}

        {/* Bookings */}
        {activeTab === 'bookings' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Bookings</h2>
          <div className="rounded-xl border border-gray-200/80 bg-puaa-surface overflow-hidden shadow-lg">
            {loading ? (
              <p className="p-6 text-base text-gray-400">Loading…</p>
            ) : confirmedBookings.length === 0 ? (
              <p className="p-6 text-base text-gray-500">No upcoming bookings. Request access to a listing to get started.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {confirmedBookings.map((m) => (
                  <li key={m.id} className="px-4 py-4 flex justify-between items-start">
                    <div>
                      <span className="text-sm font-medium px-2 py-1 rounded bg-green-50 text-green-700">confirmed</span>
                      <div className="mt-2 text-base text-gray-900">Sighting #{m.sighting_id}</div>
                      <div className="text-sm text-gray-500">{formatDate(m.start_time)} → {formatDate(m.end_time)}</div>
                      {m.instructions && <p className="text-sm text-gray-600 mt-1">{m.instructions}</p>}
                    </div>
                    <button
                      onClick={() => handleCancelMatch(m.id)}
                      className="text-sm text-red-600 hover:underline shrink-0"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        )}
        </div>
      </main>
    </div>
  )
}
