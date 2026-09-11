/**
 * In-memory file cache for the active browser session.
 * 
 * SECURITY DIRECTIVE:
 * Never store raw file bytes inside application JSON, state trees, or localStorage.
 * File binaries are stored only in this transient in-memory map or uploaded to Supabase Storage.
 */

const fileCache = new Map<string, { file: File | Blob; base64?: string; mimeType: string; fileName: string }>()

export const storeSessionFile = async (documentId: string, file: File | Blob, fileName: string): Promise<void> => {
  const mimeType = file.type || 'application/octet-stream'
  fileCache.set(documentId, { file, mimeType, fileName })
}

export const getSessionFile = (documentId: string) => {
  return fileCache.get(documentId) || null
}

export const getSessionFileBase64 = async (documentId: string): Promise<{ base64: string; mimeType: string; fileName: string } | null> => {
  const cached = fileCache.get(documentId)
  if (!cached) return null

  if (cached.base64) {
    return { base64: cached.base64, mimeType: cached.mimeType, fileName: cached.fileName }
  }

  const arrayBuffer = await cached.file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  cached.base64 = base64

  return { base64, mimeType: cached.mimeType, fileName: cached.fileName }
}

export const removeSessionFile = (documentId: string): void => {
  fileCache.delete(documentId)
}

export const clearSessionFiles = (): void => {
  fileCache.clear()
}
