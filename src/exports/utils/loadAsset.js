/**
 * Fetch an image URL and return it as a base64 data URL for embedding in a PDF.
 * Resolves to `{ data, format }` (format = 'PNG' | 'JPEG'), or null on any failure.
 */
export async function loadAssetBase64(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve({
        data: reader.result,
        format: blob.type === 'image/png' ? 'PNG' : 'JPEG',
      })
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
