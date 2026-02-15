import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import * as api from '../api'

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const formatDate = (s) => (s ? new Date(s).toLocaleString() : '-')

export default function HunterBook() {
  const { propertyId } = useParams()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [sightings, setSightings] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requesting, setRequesting] = useState(null)
  const [requestSent, setRequestSent] = useState(false)
  const [messageToLandowner, setMessageToLandowner] = useState('')

  useEffect(() => {
    setUserLocation(null)
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      )
    }
  }, [])

  useEffect(() => {
    async function load() {
      if (!propertyId) return
      setLoading(true)
      setError('')
      try {
        const [prop, sightRes] = await Promise.all([
          api.getProperty(parseInt(propertyId, 10)),
          api.listSightingsForHunter({ page: 1, page_size: 100 }),
        ])
        setProperty(prop)
        const sights = Array.isArray(sightRes) ? sightRes : []
        setSightings(sights.filter((s) => s.property_id === parseInt(propertyId, 10)))
      } catch (err) {
        setError(err.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [propertyId])

  const handleRequestAccess = async (sightingId) => {
    setRequesting(sightingId)
    setError('')
    try {
      await api.requestAccess(sightingId, { message: messageToLandowner ?? '' })
      navigate('/hunter/dashboard?tab=bookings', { state: { requestSent: true } })
    } catch (err) {
      setError(err.message || 'Failed to request access')
    } finally {
      setRequesting(null)
    }
  }

  if (loading && !property) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-base text-gray-500">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-base text-red-600">Property not found.</p>
          <Link to="/hunter/dashboard" className="mt-4 inline-block text-base text-gray-600 hover:underline">← Back to dashboard</Link>
          </div>
        </main>
      </div>
    )
  }

  const distanceKm = userLocation && property.lat != null && property.lng != null
    ? haversineKm(userLocation.lat, userLocation.lng, property.lat, property.lng)
    : null

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto px-6 py-8">
        <Link to="/hunter/dashboard" className="text-base text-gray-600 hover:underline mb-4 inline-block">← Back to dashboard</Link>

        <h1 className="text-2xl font-semibold text-gray-900">Book</h1>
        <p className="text-base text-gray-500 mt-1 mb-6">{property.name || `Property #${property.id}`}</p>

        {error && <p className="mb-4 text-red-600 text-base">{error}</p>}
        {requestSent && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-base text-green-800">
            Access request sent. The landowner will review and can approve or reject. If approved, you&apos;ll see the booking in your Bookings tab.
          </div>
        )}

        <div className="rounded-xl border border-gray-200/80 bg-puaa-surface p-6 mb-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Property details</h2>
          <dl className="space-y-2 text-base">
            <div>
              <dt className="text-gray-500">Location</dt>
              <dd className="text-gray-900">({property.lat?.toFixed(4)}, {property.lng?.toFixed(4)}){property.island && ` • ${property.island}`}</dd>
            </div>
            {property.notes && (
              <div>
                <dt className="text-gray-500">Notes</dt>
                <dd className="text-gray-900">{property.notes}</dd>
              </div>
            )}
            {property.daily_rate != null && property.daily_rate > 0 && (
              <div>
                <dt className="text-gray-500">Daily rate</dt>
                <dd className="text-gray-900">${property.daily_rate}/day</dd>
              </div>
            )}
            {distanceKm != null && (
              <div>
                <dt className="text-gray-500">Distance from you</dt>
                <dd className="text-gray-900">{distanceKm.toFixed(1)} km</dd>
              </div>
            )}
            {property.size_acres != null && property.size_acres > 0 && (
              <div>
                <dt className="text-gray-500">Property size</dt>
                <dd className="text-gray-900">{property.size_acres} acres</dd>
              </div>
            )}
            {property.max_hunters != null && property.max_hunters > 0 && (
              <div>
                <dt className="text-gray-500">Hunting area size</dt>
                <dd className="text-gray-900">Up to {property.max_hunters} hunters</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200/80 bg-puaa-surface p-6 mb-6 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Message landowner</h2>
          <p className="text-sm text-gray-500 mb-3">Include a message with your access request. The landowner will see it when reviewing.</p>
          <textarea
            value={messageToLandowner}
            onChange={(e) => setMessageToLandowner(e.target.value)}
            placeholder="e.g. I'm available weekends, experienced hunter, happy to follow any rules..."
            className="w-full px-3 py-2 text-base rounded-lg border border-gray-200/80 bg-puaa-cream focus:outline-none focus:ring-1 focus:ring-gray-400"
            rows={3}
          />
          <button
            onClick={() => sightings[0] && handleRequestAccess(sightings[0].id)}
            disabled={requesting}
            className="mt-4 w-full py-3 px-6 text-base font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {requesting ? 'Sending…' : 'Book'}
          </button>
        </div>

        {sightings.length > 0 && (
          <div className="rounded-xl border border-gray-200/80 bg-puaa-surface p-6 mb-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Examples of pig sightings</h2>
              <p className="text-base text-gray-500 mb-4">These are recent pig sightings reported at this location.</p>
              <ul className="space-y-4">
                {sightings.map((s) => (
                  <li key={s.id} className="p-4 rounded-lg border border-gray-200/60 bg-puaa-cream/60 shadow-md">
                    <div className="text-base font-medium text-gray-900">Sighting #{s.id}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{formatDate(s.seen_at)} • ({s.lat}, {s.lng})</div>
                    {s.notes && <p className="text-sm text-gray-600 mt-1">{s.notes}</p>}
                    {s.summary && <p className="text-sm text-gray-500 mt-0.5">{s.summary}</p>}
                  </li>
                ))}
              </ul>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
