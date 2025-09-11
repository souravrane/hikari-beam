import { P2PMessage, FileMetadata, BitfieldInfo } from './types'
import { 
  getFileRecord,
  getBitfieldInfo,
  getMissingRanges,
  updateBitfield
} from './idb'

/**
 * Resume Protocol Implementation
 * Handles pause/resume functionality when host disconnects/reconnects
 */

export interface ResumeState {
  fileId: string
  isPaused: boolean
  hostOnline: boolean
  lastActivity: number
  missingRanges: { start: number; end: number }[]
}

/**
 * Handle host disconnect - pause all transfers
 */
export async function handleHostDisconnect(fileId: string): Promise<ResumeState> {
  const missingRanges = await getMissingRanges(fileId)
  
  const resumeState: ResumeState = {
    fileId,
    isPaused: true,
    hostOnline: false,
    lastActivity: Date.now(),
    missingRanges
  }
  
  console.log(`Host disconnected. Paused transfer for file ${fileId}`)
  console.log(`Missing ranges:`, missingRanges)
  
  return resumeState
}

/**
 * Handle host rejoin - prepare resume data
 */
export async function handleHostRejoin(
  fileId: string,
  onSendMessage: (message: P2PMessage) => Promise<void>
): Promise<ResumeState> {
  const bitfieldInfo = await getBitfieldInfo(fileId)
  if (!bitfieldInfo) {
    throw new Error(`No bitfield info found for file ${fileId}`)
  }
  
  const missingRanges = await getMissingRanges(fileId)
  
  // Send NEED message to host with missing ranges
  if (missingRanges.length > 0) {
    await onSendMessage({
      type: 'NEED',
      data: {
        missingRanges
      },
      timestamp: Date.now()
    })
    
    console.log(`Sent NEED message to host for ${missingRanges.length} missing ranges`)
  }
  
  const resumeState: ResumeState = {
    fileId,
    isPaused: false,
    hostOnline: true,
    lastActivity: Date.now(),
    missingRanges
  }
  
  console.log(`Host rejoined. Resuming transfer for file ${fileId}`)
  
  return resumeState
}

/**
 * Process NEED message from peer (host side)
 */
export async function handleNeedMessage(
  message: P2PMessage,
  fileMetadata: FileMetadata,
  file: File,
  onSendChunk: (index: number, data: ArrayBuffer) => Promise<void>
): Promise<void> {
  if (message.type !== 'NEED') {
    throw new Error('Expected NEED message')
  }
  
  const { missingRanges } = message.data
  
  console.log(`Received NEED message with ${missingRanges.length} missing ranges`)
  
  // Send missing chunks to peer
  for (const range of missingRanges) {
    for (let index = range.start; index <= range.end; index++) {
      try {
        // Read chunk from file
        const offset = index * fileMetadata.chunkSize
        const chunkSize = Math.min(
          fileMetadata.chunkSize,
          fileMetadata.size - offset
        )
        
        const chunk = file.slice(offset, offset + chunkSize)
        const chunkData = await chunk.arrayBuffer()
        
        // Send chunk to peer
        await onSendChunk(index, chunkData)
        
        // Add small delay to prevent overwhelming the peer
        if (index % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
      } catch (error) {
        console.error(`Failed to send chunk ${index}:`, error)
        break // Stop sending on error
      }
    }
  }
  
  console.log(`Finished sending missing chunks for ranges:`, missingRanges)
}

/**
 * Create resume session data for persistence
 */
export interface ResumeSession {
  fileId: string
  roomId: string
  metadata: FileMetadata
  bitfield: Uint8Array
  receivedCount: number
  startTime: number
  lastActivity: number
  transferSpeed: number
  estimatedCompletion: number
}

export async function createResumeSession(
  fileId: string,
  roomId: string
): Promise<ResumeSession | null> {
  const record = await getFileRecord(fileId)
  if (!record) {
    return null
  }
  
  const now = Date.now()
  const elapsedTime = (now - record.createdAt) / 1000
  const transferSpeed = elapsedTime > 0 ? 
    (record.receivedCount * record.metadata.chunkSize) / elapsedTime : 0
  
  const remainingChunks = record.metadata.totalChunks - record.receivedCount
  const estimatedCompletion = transferSpeed > 0 ? 
    (remainingChunks * record.metadata.chunkSize) / transferSpeed : 0
  
  return {
    fileId,
    roomId,
    metadata: record.metadata,
    bitfield: record.bitfield,
    receivedCount: record.receivedCount,
    startTime: record.createdAt,
    lastActivity: record.lastAccessed,
    transferSpeed,
    estimatedCompletion
  }
}

/**
 * Validate resume session integrity
 */
export async function validateResumeSession(session: ResumeSession): Promise<boolean> {
  try {
    const record = await getFileRecord(session.fileId)
    if (!record) {
      console.warn(`Resume validation failed: no record for ${session.fileId}`)
      return false
    }
    
    // Verify metadata matches
    if (record.metadata.name !== session.metadata.name ||
        record.metadata.size !== session.metadata.size ||
        record.metadata.totalChunks !== session.metadata.totalChunks) {
      console.warn('Resume validation failed: metadata mismatch')
      return false
    }
    
    // Verify bitfield integrity
    if (record.bitfield.length !== session.bitfield.length) {
      console.warn('Resume validation failed: bitfield length mismatch')
      return false
    }
    
    // Count received chunks and verify consistency
    let actualReceivedCount = 0
    for (let i = 0; i < record.metadata.totalChunks; i++) {
      const byteIndex = Math.floor(i / 8)
      const bitIndex = i % 8
      if (byteIndex < record.bitfield.length) {
        const hasBit = (record.bitfield[byteIndex] & (1 << (7 - bitIndex))) !== 0
        if (hasBit) {
          actualReceivedCount++
        }
      }
    }
    
    if (actualReceivedCount !== record.receivedCount) {
      console.warn(`Resume validation failed: chunk count mismatch (${actualReceivedCount} vs ${record.receivedCount})`)
      // Try to fix the count
      await updateBitfield(session.fileId, record.bitfield, actualReceivedCount)
    }
    
    console.log(`Resume session validated for ${session.fileId}: ${actualReceivedCount}/${record.metadata.totalChunks} chunks`)
    return true
    
  } catch (error) {
    console.error('Resume validation error:', error)
    return false
  }
}

/**
 * Calculate resume progress
 */
export function calculateResumeProgress(session: ResumeSession): {
  percentage: number
  remainingBytes: number
  estimatedTime: number
} {
  const totalBytes = session.metadata.size
  const receivedBytes = session.receivedCount * session.metadata.chunkSize
  const percentage = (receivedBytes / totalBytes) * 100
  const remainingBytes = totalBytes - receivedBytes
  
  let estimatedTime = 0
  if (session.transferSpeed > 0) {
    estimatedTime = remainingBytes / session.transferSpeed
  }
  
  return {
    percentage: Math.min(percentage, 100),
    remainingBytes,
    estimatedTime
  }
}

/**
 * Generate resume handshake message
 */
export async function generateResumeHandshake(fileId: string): Promise<P2PMessage> {
  const bitfieldInfo = await getBitfieldInfo(fileId)
  if (!bitfieldInfo) {
    throw new Error(`No bitfield info for file ${fileId}`)
  }
  
  return {
    type: 'BITFIELD',
    data: {
      bitfield: Array.from(bitfieldInfo.bitfield), // Convert to array for JSON
      receivedCount: bitfieldInfo.receivedCount
    },
    timestamp: Date.now()
  }
}

/**
 * Process resume handshake from peer
 */
export async function processResumeHandshake(
  message: P2PMessage,
  expectedFileId: string
): Promise<{ missingRanges: { start: number; end: number }[]; peerProgress: number }> {
  if (message.type !== 'BITFIELD') {
    throw new Error('Expected BITFIELD message for resume handshake')
  }
  
  const { bitfield: peerBitfieldArray, receivedCount } = message.data
  const peerBitfield = new Uint8Array(peerBitfieldArray)
  
  // Calculate peer progress
  const record = await getFileRecord(expectedFileId)
  if (!record) {
    throw new Error(`No file record found for ${expectedFileId}`)
  }
  
  const peerProgress = (receivedCount / record.metadata.totalChunks) * 100
  
  // Find missing chunks by comparing bitfields
  const missingChunks: number[] = []
  for (let i = 0; i < record.metadata.totalChunks; i++) {
    const byteIndex = Math.floor(i / 8)
    const bitIndex = i % 8
    
    if (byteIndex >= peerBitfield.length) {
      missingChunks.push(i)
      continue
    }
    
    const hasBit = (peerBitfield[byteIndex] & (1 << (7 - bitIndex))) !== 0
    if (!hasBit) {
      missingChunks.push(i)
    }
  }
  
  // Group missing chunks into ranges
  const missingRanges: { start: number; end: number }[] = []
  let currentRange: { start: number; end: number } | null = null
  
  for (const chunkIndex of missingChunks) {
    if (!currentRange) {
      currentRange = { start: chunkIndex, end: chunkIndex }
    } else if (chunkIndex === currentRange.end + 1) {
      currentRange.end = chunkIndex
    } else {
      missingRanges.push(currentRange)
      currentRange = { start: chunkIndex, end: chunkIndex }
    }
  }
  
  if (currentRange) {
    missingRanges.push(currentRange)
  }
  
  console.log(`Resume handshake processed: peer at ${peerProgress.toFixed(1)}%, ${missingRanges.length} missing ranges`)
  
  return { missingRanges, peerProgress }
}