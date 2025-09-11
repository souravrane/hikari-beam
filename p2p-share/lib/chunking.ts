import { FileMetadata, ChunkInfo } from './types'

// Default chunk size: 32KB (configurable)
export const DEFAULT_CHUNK_SIZE = 32 * 1024

/**
 * Generate file metadata from a File object
 */
export async function generateFileMetadata(
  file: File, 
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<FileMetadata> {
  const totalChunks = Math.ceil(file.size / chunkSize)
  
  // Generate fileId from file properties + first chunk for uniqueness
  const fileId = await generateFileId(file)

  return {
    fileId,
    name: file.name,
    size: file.size,
    type: file.type,
    chunkSize,
    totalChunks,
    createdAt: Date.now()
  }
}

/**
 * Generate a unique file ID
 * Uses file properties + first chunk hash for uniqueness
 */
async function generateFileId(file: File): Promise<string> {
  // For MVP, use a simple approach combining file metadata
  // In production, you'd want to hash the first chunk for uniqueness
  const metadata = `${file.name}_${file.size}_${file.lastModified}`
  
  const encoder = new TextEncoder()
  const data = encoder.encode(metadata)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => {
    const hex = b.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
  
  return hashHex
}

/**
 * Get information about a specific chunk
 */
export function getChunkInfo(chunkIndex: number, totalSize: number, chunkSize: number): ChunkInfo {
  const offset = chunkIndex * chunkSize
  const remainingBytes = totalSize - offset
  const actualSize = Math.min(chunkSize, remainingBytes)

  return {
    index: chunkIndex,
    size: actualSize,
    offset
  }
}

/**
 * Read a specific chunk from a file
 */
export async function readChunk(file: File, chunkIndex: number, chunkSize: number): Promise<ArrayBuffer> {
  const chunkInfo = getChunkInfo(chunkIndex, file.size, chunkSize)
  const slice = file.slice(chunkInfo.offset, chunkInfo.offset + chunkInfo.size)
  
  return await slice.arrayBuffer()
}

/**
 * Create a readable stream for chunked file reading
 * This is useful for processing large files without loading them entirely into memory
 */
export function createChunkStream(file: File, chunkSize: number = DEFAULT_CHUNK_SIZE) {
  let currentIndex = 0
  const totalChunks = Math.ceil(file.size / chunkSize)

  return new ReadableStream({
    async pull(controller) {
      if (currentIndex >= totalChunks) {
        controller.close()
        return
      }

      try {
        const chunkBuffer = await readChunk(file, currentIndex, chunkSize)
        const chunkData = {
          index: currentIndex,
          data: chunkBuffer,
          isLast: currentIndex === totalChunks - 1
        }
        
        controller.enqueue(chunkData)
        currentIndex++
      } catch (error) {
        controller.error(error)
      }
    }
  })
}

/**
 * Validate chunk size - ensure it's within reasonable bounds
 */
export function validateChunkSize(chunkSize: number): boolean {
  const MIN_CHUNK_SIZE = 1024 // 1KB minimum
  const MAX_CHUNK_SIZE = 1024 * 1024 // 1MB maximum
  
  return chunkSize >= MIN_CHUNK_SIZE && chunkSize <= MAX_CHUNK_SIZE
}

/**
 * Calculate optimal chunk size based on file size
 */
export function calculateOptimalChunkSize(fileSize: number): number {
  // Small files: 16KB chunks
  if (fileSize < 1024 * 1024) { // < 1MB
    return 16 * 1024
  }
  
  // Medium files: 32KB chunks
  if (fileSize < 100 * 1024 * 1024) { // < 100MB
    return 32 * 1024
  }
  
  // Large files: 64KB chunks
  return 64 * 1024
}

/**
 * Estimate transfer time based on chunk size and connection speed
 */
export function estimateTransferTime(
  fileSize: number, 
  chunkSize: number, 
  bytesPerSecond: number
): { totalChunks: number; estimatedSeconds: number } {
  const totalChunks = Math.ceil(fileSize / chunkSize)
  const estimatedSeconds = fileSize / bytesPerSecond
  
  return { totalChunks, estimatedSeconds }
}

/**
 * Create request ranges for efficient chunk requesting
 * Groups sequential missing chunks into ranges
 */
export function createRequestRanges(
  missingChunks: number[], 
  maxRangeSize: number = 64
): { start: number; end: number }[] {
  if (missingChunks.length === 0) {
    return []
  }

  const ranges: { start: number; end: number }[] = []
  let currentStart = missingChunks[0]
  let currentEnd = missingChunks[0]

  for (let i = 1; i < missingChunks.length; i++) {
    const chunk = missingChunks[i]
    
    // If chunk is sequential and within range limit
    if (chunk === currentEnd + 1 && (currentEnd - currentStart + 1) < maxRangeSize) {
      currentEnd = chunk
    } else {
      // End current range, start new one
      ranges.push({ start: currentStart, end: currentEnd })
      currentStart = chunk
      currentEnd = chunk
    }
  }

  // Add the last range
  ranges.push({ start: currentStart, end: currentEnd })

  return ranges
}

/**
 * Convert bitfield to list of missing chunk indices
 */
export function getMissingChunksFromBitfield(bitfield: Uint8Array, totalChunks: number): number[] {
  const missing: number[] = []
  
  for (let i = 0; i < totalChunks; i++) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = i % 8
    
    if (byteIndex >= bitfield.length) {
      missing.push(i)
      continue
    }
    
    const hasBit = (bitfield[byteIndex] & (1 << (7 - bitIndex))) !== 0
    if (!hasBit) {
      missing.push(i)
    }
  }
  
  return missing
}

/**
 * Calculate transfer progress statistics
 */
export function calculateTransferStats(
  receivedChunks: number,
  totalChunks: number,
  chunkSize: number,
  startTime: number
): {
  percentage: number
  receivedBytes: number
  totalBytes: number
  speed: number // bytes per second
  eta: number // estimated time remaining in seconds
} {
  const now = Date.now()
  const elapsedSeconds = (now - startTime) / 1000
  
  const receivedBytes = receivedChunks * chunkSize
  const totalBytes = totalChunks * chunkSize
  const percentage = (receivedChunks / totalChunks) * 100
  
  const speed = elapsedSeconds > 0 ? receivedBytes / elapsedSeconds : 0
  const remainingBytes = totalBytes - receivedBytes
  const eta = speed > 0 ? remainingBytes / speed : Infinity
  
  return {
    percentage: Math.min(percentage, 100),
    receivedBytes,
    totalBytes,
    speed,
    eta: eta === Infinity ? 0 : eta
  }
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

/**
 * Format transfer speed for display
 */
export function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s'
}

/**
 * Format time duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0 || !isFinite(seconds)) {
    return '--'
  }
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const remainingMinutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${remainingMinutes}m`
  }
}