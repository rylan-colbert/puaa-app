import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-white/20 bg-black/30 backdrop-blur-sm">
        <nav className="flex items-center justify-between w-full px-6 py-4">
          <Link to="/" className="font-display text-xl font-semibold text-white tracking-tight shrink-0">
            Pua'a
          </Link>
          <div className="flex items-center gap-6">
            {user ? (
              <>
                <Link to={`${user.role === 'hunter' ? '/hunter' : '/landowner'}/dashboard`} className="text-base text-white/90 hover:text-white transition">
                  Dashboard
                </Link>
                <Link to={`${user.role === 'hunter' ? '/hunter' : '/landowner'}/dashboard?tab=messages`} className="text-base text-white/90 hover:text-white transition">
                  Messages
                </Link>
                <span className="text-base text-white/70">{user.email}</span>
              </>
            ) : (
              <>
                <Link to="/hunter/signin" className="text-base text-white/90 hover:text-white transition">
                  Hunter
                </Link>
                <Link to="/landowner/signin" className="text-base text-white/90 hover:text-white transition">
                  Landowner
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main
        className="relative flex flex-col items-center justify-center px-6 py-24 sm:py-32 min-h-screen w-full"
        aria-label="Hero"
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(/hero-pigs.png)`,
          }}
        />
        <div className="absolute inset-0 bg-gray-900/70" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold text-white tracking-tight drop-shadow-sm">
            Connect Landowners & Hunters
          </h1>
          <p className="mt-4 text-gray-200 text-lg sm:text-xl drop-shadow-sm">
            Safely manage wild pig populations. Landowners report sightings. Hunters get legal access.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              to={user?.role === 'hunter' ? '/hunter/dashboard' : '/hunter/signin'}
              className="inline-flex justify-center px-6 py-3 rounded-lg bg-puaa-surface text-gray-900 text-base font-medium hover:bg-puaa-cream transition shadow-lg"
            >
              {user?.role === 'hunter' ? 'Dashboard' : "I'm a Hunter"}
            </Link>
            <Link
              to={user?.role === 'landowner' ? '/landowner/dashboard' : '/landowner/signin'}
              className="inline-flex justify-center px-6 py-3 rounded-lg border-2 border-white text-white text-base font-medium hover:bg-white/10 transition"
            >
              {user?.role === 'landowner' ? 'Dashboard' : "I'm a Landowner"}
            </Link>
          </div>
        </div>
      </main>

      <section className="border-t border-gray-200/80 bg-puaa-surface py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-base font-medium text-gray-500 uppercase tracking-wider text-center mb-6">
            Our mission
          </h2>
          <p className="text-xl text-gray-700 text-center leading-relaxed">
            Pua'a exists to <strong>reduce invasive wild pig damage</strong> by connecting landowners who see the problem with hunters who can help — safely, legally, and on terms that respect private land and local culture. We make it easy to report sightings, request access, and coordinate so more pigs are managed where they cause the most harm.
          </p>
        </div>
      </section>

      <section className="border-t border-gray-200/60 py-16 px-6 bg-puaa-surface/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-base font-medium text-gray-500 uppercase tracking-wider text-center mb-6">
            The problem: Hawaii & the Pacific
          </h2>
          <div className="space-y-4 text-lg text-gray-700 leading-relaxed">
            <p>
              Across <strong>Hawaii and other Pacific Islands</strong>, feral pigs are one of the most destructive invasive species. They root through native forest understory, trample rare plants, and damage watersheds that communities depend on. They spread invasive seeds and disease, threaten endangered birds and snails, and ruin crops and cultural sites. In places where hunting is allowed, coordinated removal is one of the few tools that can scale without chemicals or fences.
            </p>
            <p>
              Too often, though, landowners don’t know how to connect with responsible hunters, and hunters can’t easily find where they’re needed. Pua'a closes that gap: landowners report what they see; hunters in the area get clear, legal access; and together we help protect land, water, and native ecosystems across the Pacific.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200/80 bg-puaa-surface py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-base font-medium text-gray-500 uppercase tracking-wider text-center mb-4">
            Why Pua'a
          </h2>
          <p className="text-center text-lg text-gray-600 mb-10 max-w-xl mx-auto">
            One simple flow: you report or subscribe → hunters see sightings and request access → you approve → they hunt. No guesswork, no cold calls.
          </p>
          <div className="grid sm:grid-cols-2 gap-10 sm:gap-12">
            <div className="rounded-xl border border-gray-200/80 bg-puaa-cream/40 p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">For landowners</h3>
              <ul className="space-y-2 text-base text-gray-600">
                <li className="flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>You report where you see pigs — only hunters in that area see it.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>You decide who gets access. Approve or reject each request.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>You set the date and any instructions. You stay in control.</span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200/80 bg-puaa-cream/40 p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">For hunters</h3>
              <ul className="space-y-2 text-base text-gray-600">
                <li className="flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>You add your hunting area. New sightings in that area show up for you.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>You request access with one click. The landowner approves or says no.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>When approved, you get a clear booking and can go hunt — legally.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-6 px-6 text-center text-sm text-gray-400">
        Pua'a — Safe, legal wild pig management.
      </footer>
    </div>
  )
}
