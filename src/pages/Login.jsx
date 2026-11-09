import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginWithEmailPassword, loginWithGoogle } from '../lib/firebase/auth'
import { practiceMode } from '../db'
import { useAuth } from '../context/AuthContext'
import PageWrapper from '../components/layout/PageWrapper'

export default function Login() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { document.title = 'Sign in | CGA' }, [])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await loginWithEmailPassword(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err?.message || 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageWrapper className="max-w-md">
      <h1 className="section-title">Sign in</h1>
      <div className="gold-divider" />
      {practiceMode ? (
        <div className="bg-white border border-[#E5E0D4] rounded-xl p-5">
          <p className="text-sm text-gray-600">Practice mode is already signed in as a board member. Nothing here is written to the live site.</p>
          <Link to="/admin" className="btn-primary mt-4">Open the practice admin</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white border border-[#E5E0D4] rounded-xl p-5 space-y-3">
          {isAuthenticated && <p className="text-sm text-gray-600">You are already signed in. <Link to="/admin" className="underline">Go to admin</Link>.</p>}
          <label className="block text-sm">Email
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E0D4] px-3 py-2" />
          </label>
          <label className="block text-sm">Password
            <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E0D4] px-3 py-2" />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="btn-outline w-full" onClick={() => loginWithGoogle().then(() => navigate('/admin')).catch((err) => setError(err?.message || 'Google sign-in failed.'))}>Sign in with Google</button>
        </form>
      )}
    </PageWrapper>
  )
}
