import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth } from './client'
import { upsertUserProfile } from './firestore'

const googleProvider = new GoogleAuthProvider()

function isPermissionError(error) {
  return error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied'
}

async function upsertUserProfileSafely(user) {
  try {
    await upsertUserProfile(user)
  } catch (error) {
    if (!isPermissionError(error)) throw error
    console.warn('Signed in, but could not persist user profile to Firestore.', error)
  }
}

export function listenForAuthChanges(callback, onError) {
  return onAuthStateChanged(auth, callback, onError)
}

export async function loginWithEmailPassword(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  await upsertUserProfileSafely(cred.user)
  return cred.user
}

export async function loginWithGoogle() {
  try {
    const cred = await signInWithPopup(auth, googleProvider)
    await upsertUserProfileSafely(cred.user)
    return cred.user
  } catch (error) {
    if (error?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider)
      return null
    }
    throw error
  }
}

export function logout() {
  return signOut(auth)
}
