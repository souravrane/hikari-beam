import { FileMetadata, ChunkRecord, FileRecord, BitfieldInfo } from './types'

/**
 * IndexedDB wrapper for P2P file sharing
 * Stores chunks and bitfields for resume capability
 */

const DB_NAME = 'P2PFileShare'
const DB_VERSION = 1
const CHUNKS_STORE = 'chunks'
const FILES_STORE = 'files'

let dbInstance: IDBDatabase | null = null

export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Chunks store: stores individual file chunks
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunksStore = db.createObjectStore(CHUNKS_STORE, {
          keyPath: ['fileId', 'index']
        })
        chunksStore.createIndex('fileId', 'fileId', { unique: false })
        chunksStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Files store: stores metadata and bitfields
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const filesStore = db.createObjectStore(FILES_STORE, {
          keyPath: 'fileId'
        })
        filesStore.createIndex('lastAccessed', 'lastAccessed', { unique: false })
      }
    }
  })
}

// Chunk Operations
export async function putChunk(fileId: string, index: number, data: ArrayBuffer): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHUNKS_STORE], 'readwrite')
    const store = transaction.objectStore(CHUNKS_STORE)

    const chunkRecord: ChunkRecord = {
      fileId,
      index,
      data,
      timestamp: Date.now()
    }

    const request = store.put(chunkRecord)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getChunk(fileId: string, index: number): Promise<ArrayBuffer | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHUNKS_STORE], 'readonly')
    const store = transaction.objectStore(CHUNKS_STORE)

    const request = store.get([fileId, index])
    request.onsuccess = () => {
      const result = request.result as ChunkRecord | undefined
      resolve(result ? result.data : null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function deleteChunk(fileId: string, index: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHUNKS_STORE], 'readwrite')
    const store = transaction.objectStore(CHUNKS_STORE)

    const request = store.delete([fileId, index])
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getAllChunksForFile(fileId: string): Promise<ChunkRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CHUNKS_STORE], 'readonly')
    const store = transaction.objectStore(CHUNKS_STORE)
    const index = store.index('fileId')

    const request = index.getAll(fileId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// File Operations
export async function putFileRecord(record: FileRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILES_STORE], 'readwrite')
    const store = transaction.objectStore(FILES_STORE)

    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getFileRecord(fileId: string): Promise<FileRecord | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILES_STORE], 'readonly')
    const store = transaction.objectStore(FILES_STORE)

    const request = store.get(fileId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function updateBitfield(fileId: string, bitfield: Uint8Array, receivedCount: number): Promise<void> {
  const record = await getFileRecord(fileId)
  if (!record) {
    throw new Error(`File record not found: ${fileId}`)
  }

  record.bitfield = bitfield
  record.receivedCount = receivedCount
  record.lastAccessed = Date.now()

  await putFileRecord(record)
}

export async function getBitfieldInfo(fileId: string): Promise<BitfieldInfo | null> {
  const record = await getFileRecord(fileId)
  if (!record) {
    return null
  }

  return {
    fileId: record.fileId,
    bitfield: record.bitfield,
    receivedCount: record.receivedCount,
    totalChunks: record.metadata.totalChunks,
    lastUpdated: record.lastAccessed
  }
}

// Utility Functions
export async function getMissingRanges(fileId: string): Promise<{ start: number; end: number }[]> {
  const bitfieldInfo = await getBitfieldInfo(fileId)
  if (!bitfieldInfo) {
    return []
  }

  const ranges: { start: number; end: number }[] = []
  let start = -1

  for (let i = 0; i < bitfieldInfo.totalChunks; i++) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = i % 8
    const hasBit = (bitfieldInfo.bitfield[byteIndex] & (1 << (7 - bitIndex))) !== 0

    if (!hasBit && start === -1) {
      start = i
    } else if (hasBit && start !== -1) {
      ranges.push({ start, end: i - 1 })
      start = -1
    }
  }

  if (start !== -1) {
    ranges.push({ start, end: bitfieldInfo.totalChunks - 1 })
  }

  return ranges
}

export async function setBitfieldBit(fileId: string, chunkIndex: number): Promise<void> {
  const record = await getFileRecord(fileId)
  if (!record) {
    throw new Error(`File record not found: ${fileId}`)
  }

  const byteIndex = Math.floor(chunkIndex / 8)
  const bitIndex = chunkIndex % 8

  // Ensure bitfield is large enough
  if (byteIndex >= record.bitfield.length) {
    const newBitfield = new Uint8Array(byteIndex + 1)
    newBitfield.set(record.bitfield)
    record.bitfield = newBitfield
  }

  // Set the bit
  record.bitfield[byteIndex] |= (1 << (7 - bitIndex))
  record.receivedCount++
  record.lastAccessed = Date.now()

  await putFileRecord(record)
}

export async function hasBitfieldBit(fileId: string, chunkIndex: number): Promise<boolean> {
  const record = await getFileRecord(fileId)
  if (!record) {
    return false
  }

  const byteIndex = Math.floor(chunkIndex / 8)
  const bitIndex = chunkIndex % 8

  if (byteIndex >= record.bitfield.length) {
    return false
  }

  return (record.bitfield[byteIndex] & (1 << (7 - bitIndex))) !== 0
}

export async function getTransferProgress(fileId: string): Promise<{ received: number; total: number; percentage: number }> {
  const record = await getFileRecord(fileId)
  if (!record) {
    return { received: 0, total: 0, percentage: 0 }
  }

  return {
    received: record.receivedCount,
    total: record.metadata.totalChunks,
    percentage: (record.receivedCount / record.metadata.totalChunks) * 100
  }
}

export async function assembleFile(fileId: string): Promise<Blob | null> {
  const record = await getFileRecord(fileId)
  if (!record || record.receivedCount < record.metadata.totalChunks) {
    return null
  }

  const chunks = await getAllChunksForFile(fileId)
  chunks.sort((a, b) => a.index - b.index)

  const buffers = chunks.map(chunk => chunk.data)
  const blob = new Blob(buffers, { type: record.metadata.type })

  return blob
}

// Cleanup Functions
export async function deleteFile(fileId: string): Promise<void> {
  const db = await openDB()
  
  return new Promise(async (resolve, reject) => {
    try {
      // Delete all chunks first
      const chunks = await getAllChunksForFile(fileId)
      for (const chunk of chunks) {
        await deleteChunk(fileId, chunk.index)
      }

      // Delete file record
      const transaction = db.transaction([FILES_STORE], 'readwrite')
      const store = transaction.objectStore(FILES_STORE)
      const request = store.delete(fileId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    } catch (error) {
      reject(error)
    }
  })
}

export async function clearOldFiles(olderThanDays: number = 7): Promise<void> {
  const db = await openDB()
  const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FILES_STORE], 'readwrite')
    const store = transaction.objectStore(FILES_STORE)
    const index = store.index('lastAccessed')

    const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate))
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        const fileId = cursor.value.fileId
        deleteFile(fileId) // Async delete, don't wait
        cursor.continue()
      } else {
        resolve()
      }
    }

    request.onerror = () => reject(request.error)
  })
}

// Initialize bitfield for a new file
export function createBitfield(totalChunks: number): Uint8Array {
  const byteLength = Math.ceil(totalChunks / 8)
  return new Uint8Array(byteLength)
}

// Create host bitfield (all chunks available)
export function createHostBitfield(totalChunks: number): Uint8Array {
  const byteLength = Math.ceil(totalChunks / 8)
  const bitfield = new Uint8Array(byteLength)
  
  // Set all bits to 1
  for (let i = 0; i < totalChunks; i++) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = i % 8
    bitfield[byteIndex] |= (1 << (7 - bitIndex))
  }
  
  return bitfield
}