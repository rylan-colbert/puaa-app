import { Link, useSearchParams } from 'react-router-dom'

export default function SignIn() {
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-puaa-cream">
      <Link to="/" className="absolute top-6 left-6 font-display font-bold text-puaa-earth hover:opacity-80">
        ← Pua'a
      </Link>
      <div className="w-full max-w-sm">
        <h1 className="font-display font-bold text-2xl text-puaa-earth text-center mb-2">
          Sign in
        </h1>
        <p className="text-puaa-earth/70 text-center mb-8 text-sm">
          Choose how you want to use Pua'a
        </p>
        <div className="space-y-4">
          <Link
            to={`/hunter/signin?redirect=${encodeURIComponent(redirect)}`}
            className="block w-full py-4 px-6 rounded-xl bg-puaa-forest hover:bg-puaa-forest/90 text-puaa-cream font-semibold text-center transition"
          >
            I&apos;m a Hunter
          </Link>
          <Link
            to={`/landowner/signin?redirect=${encodeURIComponent(redirect)}`}
            className="block w-full py-4 px-6 rounded-xl bg-puaa-bark hover:bg-puaa-bark/90 text-puaa-cream font-semibold text-center transition"
          >
            I&apos;m a Landowner
          </Link>
        </div>
      </div>
    </div>
  )
}
