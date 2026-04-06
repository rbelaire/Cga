import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PageWrapper from '../components/layout/PageWrapper'
import { useAuth } from '../context/AuthContext'
import { loginWithEmailPassword, loginWithGoogle } from '../lib/firebase/auth'

function formatAuthError(error) {
  const code = error?.code ?? ''

  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Google sign-in in Firebase Auth settings.'
  }

  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing sign-in.'
  }

  if (code === 'firestore/permission-denied') {
    return 'Signed in, but your account does not have the required Firestore permissions yet.'
  }

  return error?.message ?? 'Sign-in failed. Please try again.'
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const redirectTo = location.state?.from?.pathname ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, navigate, redirectTo])

  const onEmailLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loginWithEmailPassword(email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const onGoogleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const user = await loginWithGoogle()
      if (user) {
        navigate(redirectTo, { replace: true })
      }
    } catch (err) {
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto mt-12 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h1 className="section-title text-2xl mb-2">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">Use your Firebase account to access protected tools.</p>

        <form className="space-y-3" onSubmit={onEmailLogin}>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in with Email'}
          </button>
        </form>

        <button
          type="button"
          className="mt-3 w-full px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={onGoogleLogin}
          disabled={loading}
        >
          Continue with Google
        </button>

        {error && <p className="mt-3 text-xs text-red-500 break-all">{error}</p>}

        <p className="mt-6 text-xs text-gray-500">
          Need public content? <Link to="/" className="text-forest underline">Return home</Link>.
        </p>
      </div>
    </PageWrapper>
  )
}
