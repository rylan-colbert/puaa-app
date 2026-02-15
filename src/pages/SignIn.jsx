import { Link, useSearchParams } from 'react-router-dom'

export default function SignIn() {
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <Link to="/" className="absolute top-6 left-6 text-sm font-medium text-gray-600 hover:text-gray-900">
        ← Pua'a
      </Link>
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-gray-900 text-center">Sign in</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-8">Choose your role.</p>
        <div className="space-y-3">
          <Link
            to={`/hunter/signin?redirect=${encodeURIComponent(redirect)}`}
            className="block w-full py-3 px-4 rounded-lg bg-gray-900 text-white text-sm font-medium text-center hover:bg-gray-800 transition"
          >
            Hunter
          </Link>
          <Link
            to={`/landowner/signin?redirect=${encodeURIComponent(redirect)}`}
            className="block w-full py-3 px-4 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium text-center hover:bg-puaa-cream/50 transition"
          >
            Landowner
          </Link>
        </div>
      </div>
    </div>
  )
}
