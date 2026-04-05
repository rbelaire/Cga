/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { listenForAuthChanges, logout } from '../lib/firebase/auth'
import { listenUserProfile } from '../lib/firebase/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null

    const unsubAuth = listenForAuthChanges((nextUser) => {
      setUser(nextUser)
      setLoading(false)

      if (unsubProfile) {
        unsubProfile()
        unsubProfile = null
      }

      if (nextUser?.uid) {
        unsubProfile = listenUserProfile(nextUser.uid, setProfile)
      } else {
        setProfile(null)
      }
    })

    return () => {
      unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [])

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    isAdmin: !!profile?.roles?.includes('admin'),
    signOut: logout,
  }), [user, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
