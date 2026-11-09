import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './client'
import { SUPER_ADMIN_EMAIL } from '../../domain/access'

export async function upsertUserProfile(user, roles) {
  if (!db || !user?.uid) return
  const userRef = doc(db, 'users', user.uid)
  const existing = await getDoc(userRef)
  const existingData = existing.exists() ? existing.data() : null
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL
  const nextRoles = isSuperAdmin ? ['admin'] : (Array.isArray(roles) ? roles : (existingData?.roles ?? ['member']))
  const base = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    roles: nextRoles,
    updatedAt: serverTimestamp(),
  }
  if (existing.exists()) {
    await setDoc(userRef, base, { merge: true })
    return
  }
  await setDoc(userRef, { ...base, createdAt: serverTimestamp() })
}

export async function saveSavedFilter(uid, page, filters) {
  if (!db) return
  await setDoc(doc(db, 'savedFilters', `${uid}_${page}`), {
    uid,
    page,
    filters,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })
}

export function listenSavedFilter(uid, page, callback) {
  if (!db) {
    callback(null)
    return () => {}
  }
  return onSnapshot(doc(db, 'savedFilters', `${uid}_${page}`), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  }, () => callback(null))
}

export async function saveSavedView(uid, page, settings) {
  if (!db) return
  await setDoc(doc(db, 'savedViews', `${uid}_${page}`), {
    uid,
    page,
    settings,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })
}

export function listenSavedView(uid, page, callback) {
  if (!db) {
    callback(null)
    return () => {}
  }
  return onSnapshot(doc(db, 'savedViews', `${uid}_${page}`), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  }, () => callback(null))
}
