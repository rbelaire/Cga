import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth } from './client'
import { upsertUserProfile } from './firestore'

const googleProvider = new GoogleAuthProvider()

export function listenForAuthChanges(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function loginWithEmailPassword(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  await upsertUserProfile(cred.user)
  return cred.user
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  await upsertUserProfile(cred.user)
  return cred.user
}

export function logout() {
  return signOut(auth)
}
