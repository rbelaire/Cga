/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { listenForAuthChanges, logout } from '../lib/firebase/auth'
import { DB, practiceMode } from '../db'
import { isAdminUser } from '../domain/access'

const AuthContext = createContext(null)
const practiceUser = { email: 'board@cga.local', displayName: 'Board Member', uid: 'practice' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(practiceMode ? practiceUser : null)
  const [loading, setLoading] = useState(!practiceMode)
  const [users, setUsers] = useState([])
  const [usersReady, setUsersReady] = useState(practiceMode)

  useEffect(() => {
    if (practiceMode) return undefined
    return DB.listenUsers((list) => {
      queueMicrotask(() => {
        setUsers(Array.isArray(list) ? list : [])
        setUsersReady(true)
      })
    })
  }, [])

  useEffect(() => {
    if (practiceMode) return undefined
    return listenForAuthChanges((nextUser) => {
      queueMicrotask(() => {
        setUser(nextUser)
        setLoading(false)
      })
    }, () => {
      queueMicrotask(() => {
        setUser(null)
        setLoading(false)
      })
    })
  }, [])

  const isAdmin = practiceMode || isAdminUser(user?.email, users, { loaded: usersReady })
  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin,
    usersReady,
    signOut: practiceMode ? async () => {} : logout,
  }), [user, loading, isAdmin, usersReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
