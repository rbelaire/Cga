import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './client'

export function getUserUploadRef(uid, fileName) {
  return ref(storage, `uploads/${uid}/${fileName}`)
}

export async function uploadUserFile(uid, file) {
  const fileRef = getUserUploadRef(uid, file.name)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}
