/**
 * Firebase Admin SDK initializer for server-side scripts.
 * This project currently runs as a Vite SPA, so this module is not imported
 * in the browser bundle. It is ready for future Node/server environments.
 */

let adminAppPromise = null

export async function getFirebaseAdminApp() {
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { getApps, initializeApp, cert } = await import('firebase-admin/app')

      if (getApps().length) return getApps()[0]

      const privateKey = globalThis.process?.env?.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

      return initializeApp({
        credential: cert({
          projectId: globalThis.process?.env?.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: globalThis.process?.env?.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey,
        }),
        storageBucket: globalThis.process?.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
    })()
  }

  return adminAppPromise
}

export async function getFirebaseAdminAuth() {
  const app = await getFirebaseAdminApp()
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth(app)
}
