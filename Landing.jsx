import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-puaa-forest via-puaa-earth to-puaa-bark">
        <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTIgMi0yIDR2MmMwIDIgMiA0IDIgNHMtMi0yLTItNHYtMnptMC0yMGMwLTIgMi00IDItNHMtMiAyLTIgNHYyYzAgMiAyIDQgMiA0cy0yLTItMi00di0yeiIvPjwvZz48L2c+PC9zdmc+')]"></div>
        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
          <span className="font-display font-bold text-xl text-puaa-cream tracking-tight">Pua'a</span>
          <div className="flex gap-4">
            {user ? (
              <Link to={user.role === 'hunter' ? '/hunter/dashboard' : '/landowner/dashboard'} className="text-puaa-cream/90 hover:text-white text-sm font-medium transition">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/hunter/signin" className="text-puaa-cream/90 hover:text-white text-sm font-medium transition">
                  Sign in as Hunter
                </Link>
                <Link to="/landowner/signin" className="text-puaa-cream/90 hover:text-white text-sm font-medium transition">
                  Sign in as Landowner
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-puaa-cream leading-tight tracking-tight">
            Connect Landowners & Hunters
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-puaa-cream/90 max-w-2xl mx-auto">
            Safely manage invasive wild pig populations. Landowners get help protecting their land. Hunters get legal access.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={user?.role === 'hunter' ? '/hunter/dashboard' : '/hunter/signin'}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-puaa-sage hover:bg-puaa-sage/90 text-puaa-earth font-semibold transition shadow-lg"
            >
              {user?.role === 'hunter' ? 'Go to Dashboard' : "I'm a Hunter"}
            </Link>
            <Link
              to={user?.role === 'landowner' ? '/landowner/dashboard' : '/landowner/signin'}
              className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-puaa-cream/10 border-2 border-puaa-cream/50 hover:bg-puaa-cream/20 text-puaa-cream font-semibold transition"
            >
              {user?.role === 'landowner' ? 'Go to Dashboard' : "I'm a Landowner"}
            </Link>
          </div>
        </div>
      </header>

      {/* Value prop */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-2xl text-puaa-earth text-center mb-12">
          Why Pua'a?
        </h2>
        <div className="grid md:grid-cols-3 gap-10">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-puaa-sage/30 flex items-center justify-center mx-auto mb-4 text-2xl">🛡️</div>
            <h3 className="font-display font-semibold text-puaa-earth mb-2">Protect Land Rights</h3>
            <p className="text-puaa-earth/80 text-sm">Private landowners stay in control. You approve who hunts and set the rules.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-puaa-sage/30 flex items-center justify-center mx-auto mb-4 text-2xl">📜</div>
            <h3 className="font-display font-semibold text-puaa-earth mb-2">Legal Access</h3>
            <p className="text-puaa-earth/80 text-sm">Hunters get verified access. License checks keep everyone compliant.</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-puaa-sage/30 flex items-center justify-center mx-auto mb-4 text-2xl">🌿</div>
            <h3 className="font-display font-semibold text-puaa-earth mb-2">Reduce Damage</h3>
            <p className="text-puaa-earth/80 text-sm">Invasive wild pigs damage crops, ecosystems, and infrastructure. We help coordinate removal.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-puaa-bark/20 py-8 px-6 text-center text-sm text-puaa-earth/70">
        Pua'a — Connecting landowners with hunters for safe, legal wild pig management.
      </footer>
    </div>
  )
}
