import { ref, uploadString, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './config'

/**
 * Upload a base64 data URL to Firebase Storage.
 *
 * @param {string} dataUrl   base64 data URL from @capacitor/camera
 * @param {string} path      storage path, e.g. 'facilities/CI266/enforcement/123.jpg'
 * @returns {Promise<string>} public download URL
 */
export async function uploadPhoto(dataUrl, path) {
  const storageRef = ref(storage, path)
  const snapshot = await uploadString(storageRef, dataUrl, 'data_url')
  return getDownloadURL(snapshot.ref)
}

/**
 * Delete a photo from Firebase Storage by its download URL.
 * Silently ignores errors (photo may already be gone).
 */
export async function deletePhoto(downloadUrl) {
  try {
    const storageRef = ref(storage, downloadUrl)
    await deleteObject(storageRef)
  } catch {
    // no-op
  }
}

/**
 * Build a storage path for a facility sub-record photo.
 *
 * @param {string} fileNumber  e.g. 'CI266'
 * @param {string} category    'enforcement' | 'monitoring' | 'screening' | 'site_verifications'
 * @param {string} filename    unique filename, e.g. '1234567890_abc.jpg'
 */
export function makePhotoPath(fileNumber, category, filename) {
  return `facilities/${fileNumber}/${category}/${filename}`
}

/** Generate a unique photo filename using timestamp + random suffix. */
export function uniquePhotoName() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
}

/**
 * Upload a File object (from a file input) to Firebase Storage.
 * @param {File}   file  Browser File object
 * @param {string} path  Storage path
 * @returns {Promise<string>} public download URL
 */
export async function uploadFile(file, path) {
  const storageRef = ref(storage, path)
  const snapshot = await uploadBytes(storageRef, file)
  return getDownloadURL(snapshot.ref)
}

/**
 * Delete a file from Firebase Storage by its storage path.
 * Silently ignores errors.
 */
export async function deleteFile(path) {
  try {
    await deleteObject(ref(storage, path))
  } catch {
    // no-op
  }
}
