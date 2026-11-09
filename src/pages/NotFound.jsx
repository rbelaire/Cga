import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
      <p className="text-gold font-mono text-5xl font-bold mb-4">404</p>
      <h1 className="font-heading text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-500 text-sm mb-6">That link does not match a page on this site.</p>
      <Link to="/" className="btn-primary">Back to home</Link>
    </div>
  )
}
