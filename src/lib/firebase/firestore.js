import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from './client'

/** @typedef {'admin' | 'editor' | 'member'} UserRole */

/**
 * @typedef {Object} UserDoc
 * @property {string} uid
 * @property {string | null} email
 * @property {string | null} displayName
 * @property {UserRole[]} roles
 * @property {string=} photoURL
 * @property {unknown=} createdAt
 * @property {unknown=} updatedAt
 */

/**
 * @typedef {Object} SavedFilterDoc
 * @property {string} id
 * @property {string} uid
 * @property {string} page
 * @property {Record<string, unknown>} filters
 * @property {unknown=} createdAt
 * @property {unknown=} updatedAt
 */

/**
 * @typedef {Object} SavedViewDoc
 * @property {string} id
 * @property {string} uid
 * @property {string} page
 * @property {Record<string, unknown>} settings
 * @property {unknown=} createdAt
 * @property {unknown=} updatedAt
 */

/**
 * @typedef {Object} FavoriteDoc
 * @property {string} id
 * @property {string} uid
 * @property {string} entityId
 * @property {'tournament' | 'course'} entityType
 * @property {string=} label
 * @property {unknown=} createdAt
 */

export async function upsertUserProfile(user, roles) {
  const userRef = doc(db, 'users', user.uid)
  const existing = await getDoc(userRef)
  const existingData = existing.exists() ? existing.data() : null
  const nextRoles = Array.isArray(roles) ? roles : (existingData?.roles ?? ['member'])

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

  await setDoc(userRef, {
    ...base,
    createdAt: serverTimestamp(),
  })
}

export function listenUserProfile(uid, callback) {
  const userRef = doc(db, 'users', uid)
  return onSnapshot(userRef, (snap) => {
    callback(snap.exists() ? /** @type {UserDoc} */ ({ id: snap.id, ...snap.data() }) : null)
  })
}

export async function saveSavedFilter(uid, page, filters) {
  const id = `${uid}_${page}`
  await setDoc(doc(db, 'savedFilters', id), {
    uid,
    page,
    filters,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })
}

export function listenSavedFilter(uid, page, callback) {
  const id = `${uid}_${page}`
  return onSnapshot(doc(db, 'savedFilters', id), (snap) => {
    callback(snap.exists() ? /** @type {SavedFilterDoc} */ ({ id: snap.id, ...snap.data() }) : null)
  })
}

export async function saveSavedView(uid, page, settings) {
  const id = `${uid}_${page}`
  await setDoc(doc(db, 'savedViews', id), {
    uid,
    page,
    settings,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })
}

export function listenSavedView(uid, page, callback) {
  const id = `${uid}_${page}`
  return onSnapshot(doc(db, 'savedViews', id), (snap) => {
    callback(snap.exists() ? /** @type {SavedViewDoc} */ ({ id: snap.id, ...snap.data() }) : null)
  })
}

export async function setFavorite(uid, entityType, entityId, label = '') {
  const id = `${uid}_${entityType}_${entityId}`
  await setDoc(doc(db, 'favorites', id), {
    uid,
    entityType,
    entityId,
    label,
    createdAt: serverTimestamp(),
  }, { merge: true })
}

export async function removeFavorite(uid, entityType, entityId) {
  const id = `${uid}_${entityType}_${entityId}`
  await deleteDoc(doc(db, 'favorites', id))
}

export function listenFavorites(uid, entityType, callback) {
  const favoritesRef = collection(db, 'favorites')
  const q = query(favoritesRef, where('uid', '==', uid), where('entityType', '==', entityType))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => /** @type {FavoriteDoc} */ ({ id: d.id, ...d.data() })))
  })
}

export async function listUserSavedFilters(uid) {
  const q = query(collection(db, 'savedFilters'), where('uid', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map((d) => /** @type {SavedFilterDoc} */ ({ id: d.id, ...d.data() }))
}
