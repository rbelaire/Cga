/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { listenForAuthChanges, logout } from '../lib/firebase/auth'
import { fsListen } from '../db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cgaUsers, setCgaUsers] = useState(null) // null = not yet loaded

  // Listen to cga/users for role information
  useEffect(() => {
    return fsListen('cga/users', (data) => {
      setCgaUsers(data?.list ?? [])
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    const failOpenTimer = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 10000)

    const unsubAuth = listenForAuthChanges((nextUser) => {
      clearTimeout(failOpenTimer)
      setUser(nextUser)
      setLoading(false)
    }, () => {
      clearTimeout(failOpenTimer)
      if (cancelled) return
      setUser(null)
      setLoading(false)
    })

    return () => {
      cancelled = true
      clearTimeout(failOpenTimer)
      unsubAuth()
    }
  }, [])

  const isAdmin = useMemo(() => {
    if (!user?.email) return false
    // Bootstrap: if cga/users is empty or not loaded yet, the first authenticated
    // user is treated as admin so they can set up the panel.
    if (!cgaUsers || cgaUsers.length === 0) return !!user
    const email = user.email.toLowerCase()
    return cgaUsers.some(
      u => (u.email ?? '').toLowerCase() === email &&
           u.role === 'admin' &&
           u.status !== 'disabled'
    )
  }, [user, cgaUsers])

  const value = useMemo(() => ({
    user,
    profile: user ? { displayName: user.displayName, email: user.email } : null,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    signOut: logout,
  }), [user, loading, isAdmin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
