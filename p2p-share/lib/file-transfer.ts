'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  FileMetadata, 
  P2PMessage, 
  TransferProgress,
  UseFileSenderReturn,
  UseFileReceiverReturn,
  PeerConnection
} from './types'
import { 
  generateFileMetadata,
  readChunk,
  calculateTransferStats,
  createRequestRanges,
  getMissingChunksFromBitfield
} from './chunking'
import {
  putChunk,
  getChunk,
  putFileRecord,
  getFileRecord,
  setBitfieldBit,
  getMissingRanges,
  assembleFile,
  createBitfield,
  createHostBitfield,
  updateBitfield
} from './idb'
import {
  sendMessage,
  sendChunk,
  createPeerConnection,
  createDataChannel,
  setupIncomingDataChannel
} from './webrtc'

/**
 * Hook for file sending (host side)
 */
export function useP2PFileSender(
  connections: Map<string, PeerConnection>,
  sendSignal: (peerId: string, signal: any) => void
): UseFileSenderReturn {
  const [isActive, setIsActive] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)

  const transferState = useRef<Map<string, any>>(new Map())
  const startTime = useRef<number>(0)

  const startTransfer = useCallback(async (file: File) => {
    try {
      setError(null)
      setIsActive(true)
      setCurrentFile(file)
      startTime.current = Date.now()

      // Generate file metadata
      const metadata = await generateFileMetadata(file)
      setFileMetadata(metadata)

      // Store file record for host (with full bitfield)
      const hostBitfield = createHostBitfield(metadata.totalChunks)
      await putFileRecord({
        fileId: metadata.fileId,
        metadata,
        bitfield: hostBitfield,
        receivedCount: metadata.totalChunks,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      })

      // Send metadata to all connected peers
      for (const [peerId, connection] of connections) {
        if (connection.dataChannel?.readyState === 'open') {
          await sendMessage(connection.dataChannel, {
            type: 'META',
            data: metadata,
            timestamp: Date.now()
          })
        }
      }

      console.log('File sharing started:', metadata.name)
    } catch (err) {
      console.error('Failed to start transfer:', err)
      setError(err instanceof Error ? err.message : 'Failed to start transfer')
      setIsActive(false)
    }
  }, [connections])

  const pauseTransfer = useCallback(() => {
    setIsActive(false)
    // Pause will be handled by stopping chunk sending
  }, [])

  const resumeTransfer = useCallback(() => {
    setIsActive(true)
    // Resume will be handled by continuing chunk sending
  }, [])

  // Handle peer requests for chunks
  const handlePeerMessage = useCallback(async (peerId: string, message: P2PMessage) => {
    if (!currentFile || !fileMetadata || !isActive) return

    try {
      switch (message.type) {
        case 'REQUEST':
          const { startIndex, endIndex } = message.data
          
          // Send requested chunks
          for (let index = startIndex; index <= endIndex; index++) {
            const connection = connections.get(peerId)
            if (connection?.dataChannel?.readyState === 'open') {
              const chunkData = await readChunk(currentFile, index, fileMetadata.chunkSize)
              await sendChunk(connection.dataChannel, index, chunkData)
            }
          }
          break

        case 'BITFIELD':
          // Peer sent their bitfield, we can optimize what to send
          const peerState = transferState.current.get(peerId) || {}
          peerState.bitfield = new Uint8Array(message.data.bitfield)
          peerState.receivedCount = message.data.receivedCount
          transferState.current.set(peerId, peerState)
          break

        case 'ACK':
          // Peer acknowledged receiving a chunk
          const state = transferState.current.get(peerId) || {}
          state.ackedChunks = (state.ackedChunks || new Set()).add(message.data.index)
          transferState.current.set(peerId, state)
          break
      }
    } catch (err) {
      console.error('Error handling peer message:', err)
    }
  }, [currentFile, fileMetadata, isActive, connections])

  // Calculate and update progress
  useEffect(() => {
    if (!isActive || !fileMetadata) return

    const interval = setInterval(() => {
      const totalPeers = connections.size
      let completedPeers = 0
      let totalTransferred = 0

      for (const [peerId] of connections) {
        const state = transferState.current.get(peerId)
        if (state?.receivedCount === fileMetadata.totalChunks) {
          completedPeers++
        }
        totalTransferred += (state?.receivedCount || 0)
      }

      const avgProgress = totalPeers > 0 ? (totalTransferred / (totalPeers * fileMetadata.totalChunks)) * 100 : 0
      const elapsedSeconds = (Date.now() - startTime.current) / 1000
      const avgSpeed = elapsedSeconds > 0 ? (totalTransferred * fileMetadata.chunkSize) / elapsedSeconds : 0

      setProgress({
        fileId: fileMetadata.fileId,
        totalPeers,
        completedPeers,
        activePeers: totalPeers - completedPeers,
        avgSpeed,
        totalBytes: fileMetadata.size,
        transferredBytes: totalTransferred * fileMetadata.chunkSize
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, fileMetadata, connections])

  return {
    startTransfer,
    pauseTransfer,
    resumeTransfer,
    progress,
    isActive,
    error,
    handlePeerMessage
  }
}

/**
 * Hook for file receiving (peer side)
 */
export function useP2PFileReceiver(
  connections: Map<string, PeerConnection>
): UseFileReceiverReturn {
  const [progress, setProgress] = useState<TransferProgress | null>(null)
  const [downloadedFile, setDownloadedFile] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [pendingMetadata, setPendingMetadata] = useState<FileMetadata | null>(null)

  const requestQueue = useRef<number[]>([])
  const startTime = useRef<number>(0)

  const acceptFile = useCallback(async (metadata: FileMetadata) => {
    try {
      setError(null)
      setIsActive(true)
      setPendingMetadata(null)
      startTime.current = Date.now()

      // Create file record with empty bitfield
      const bitfield = createBitfield(metadata.totalChunks)
      await putFileRecord({
        fileId: metadata.fileId,
        metadata,
        bitfield,
        receivedCount: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      })

      // Initialize progress
      setProgress({
        fileId: metadata.fileId,
        peerId: 'self',
        receivedChunks: 0,
        totalChunks: metadata.totalChunks,
        receivedBytes: 0,
        totalBytes: metadata.size,
        speed: 0,
        eta: 0,
        status: 'downloading'
      })

      // Start requesting chunks from host
      await requestMissingChunks(metadata.fileId)

      console.log('File download accepted:', metadata.name)
    } catch (err) {
      console.error('Failed to accept file:', err)
      setError(err instanceof Error ? err.message : 'Failed to accept file')
      setIsActive(false)
    }
  }, [])

  const requestMissingChunks = useCallback(async (fileId: string) => {
    try {
      const missingRanges = await getMissingRanges(fileId)
      const hostConnection = Array.from(connections.values()).find(conn => conn.id.includes('host'))
      
      if (hostConnection?.dataChannel?.readyState === 'open' && missingRanges.length > 0) {
        // Request chunks in batches
        for (const range of missingRanges.slice(0, 10)) { // Limit concurrent requests
          await sendMessage(hostConnection.dataChannel, {
            type: 'REQUEST',
            data: {
              startIndex: range.start,
              endIndex: range.end
            },
            timestamp: Date.now()
          })
        }
      }
    } catch (err) {
      console.error('Error requesting chunks:', err)
    }
  }, [connections])

  const pauseTransfer = useCallback(() => {
    setIsActive(false)
  }, [])

  const resumeTransfer = useCallback(async () => {
    setIsActive(true)
    if (progress?.fileId) {
      await requestMissingChunks(progress.fileId)
    }
  }, [progress, requestMissingChunks])

  // Handle incoming messages from host
  const handleHostMessage = useCallback(async (message: P2PMessage) => {
    try {
      switch (message.type) {
        case 'META':
          setPendingMetadata(message.data as FileMetadata)
          break

        case 'CHUNK':
          if (!progress || !isActive) return

          const { index, payload } = message.data
          const chunkData = new Uint8Array(payload).buffer

          // Store chunk
          await putChunk(progress.fileId, index, chunkData)
          await setBitfieldBit(progress.fileId, index)

          // Send acknowledgment
          const hostConnection = Array.from(connections.values()).find(conn => conn.id.includes('host'))
          if (hostConnection?.dataChannel?.readyState === 'open') {
            await sendMessage(hostConnection.dataChannel, {
              type: 'ACK',
              data: { index },
              timestamp: Date.now()
            })
          }

          // Update progress
          const record = await getFileRecord(progress.fileId)
          if (record) {
            const stats = calculateTransferStats(
              record.receivedCount,
              record.metadata.totalChunks,
              record.metadata.chunkSize,
              startTime.current
            )

            const newProgress: TransferProgress = {
              ...progress,
              receivedChunks: record.receivedCount,
              receivedBytes: stats.receivedBytes,
              speed: stats.speed,
              eta: stats.eta,
              status: record.receivedCount === record.metadata.totalChunks ? 'completed' : 'downloading'
            }

            setProgress(newProgress)

            // Check if transfer is complete
            if (record.receivedCount === record.metadata.totalChunks) {
              const file = await assembleFile(progress.fileId)
              if (file) {
                setDownloadedFile(file)
                setIsActive(false)
              }
            } else {
              // Request more chunks
              await requestMissingChunks(progress.fileId)
            }
          }
          break

        case 'BITFIELD':
          // Host sent their bitfield (should be all 1s for complete file)
          break
      }
    } catch (err) {
      console.error('Error handling host message:', err)
      setError(err instanceof Error ? err.message : 'Transfer error')
    }
  }, [progress, isActive, connections, requestMissingChunks])

  return {
    acceptFile,
    pauseTransfer,
    resumeTransfer,
    progress,
    downloadedFile,
    error,
    pendingMetadata,
    handleHostMessage
  }
}

/**
 * Hook for managing P2P connections
 */
export function useP2PConnections(
  sendSignal: (peerId: string, signal: any) => void,
  onMessage: (peerId: string, message: P2PMessage) => void
) {
  const [connections, setConnections] = useState<Map<string, PeerConnection>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async (peerId: string, isInitiator = false) => {
    try {
      setError(null)
      
      const peerConnection = createPeerConnection()
      let dataChannel: RTCDataChannel

      if (isInitiator) {
        // Create data channel (initiator)
        dataChannel = createDataChannel(
          peerConnection,
          (message) => onMessage(peerId, message),
          () => console.log(`Data channel opened with ${peerId}`),
          (error) => console.error(`Data channel error with ${peerId}:`, error)
        )
      } else {
        // Wait for incoming data channel (responder)
        peerConnection.ondatachannel = (event) => {
          dataChannel = event.channel
          setupIncomingDataChannel(
            dataChannel,
            (message) => onMessage(peerId, message),
            () => console.log(`Incoming data channel opened from ${peerId}`),
            (error) => console.error(`Incoming data channel error from ${peerId}:`, error)
          )
        }
      }

      // Set up ICE candidate handling
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerId, {
            type: 'ice-candidate',
            data: event.candidate
          })
        }
      }

      // Connection state handling
      peerConnection.onconnectionstatechange = () => {
        setConnections(prev => {
          const newConnections = new Map(prev)
          const connection = newConnections.get(peerId)
          if (connection) {
            connection.state = peerConnection.connectionState as any
            newConnections.set(peerId, connection)
          }
          return newConnections
        })
      }

      const connection: PeerConnection = {
        id: peerId,
        connection: peerConnection,
        dataChannel: isInitiator ? dataChannel : null,
        state: 'connecting'
      }

      setConnections(prev => new Map(prev.set(peerId, connection)))

      if (isInitiator) {
        // Create and send offer
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        sendSignal(peerId, {
          type: 'offer',
          data: offer
        })
      }
    } catch (err) {
      console.error('Failed to connect to peer:', err)
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [sendSignal, onMessage])

  const handleSignal = useCallback(async (peerId: string, signal: any) => {
    try {
      const connection = connections.get(peerId)
      if (!connection?.connection) return

      switch (signal.type) {
        case 'offer':
          await connection.connection.setRemoteDescription(signal.data)
          const answer = await connection.connection.createAnswer()
          await connection.connection.setLocalDescription(answer)
          sendSignal(peerId, {
            type: 'answer',
            data: answer
          })
          break

        case 'answer':
          await connection.connection.setRemoteDescription(signal.data)
          break

        case 'ice-candidate':
          await connection.connection.addIceCandidate(signal.data)
          break
      }
    } catch (err) {
      console.error('Failed to handle signal:', err)
      setError(err instanceof Error ? err.message : 'Signaling error')
    }
  }, [connections, sendSignal])

  const disconnect = useCallback((peerId: string) => {
    const connection = connections.get(peerId)
    if (connection) {
      connection.connection?.close()
      setConnections(prev => {
        const newConnections = new Map(prev)
        newConnections.delete(peerId)
        return newConnections
      })
    }
  }, [connections])

  const sendMessage = useCallback(async (peerId: string, message: P2PMessage) => {
    const connection = connections.get(peerId)
    if (connection?.dataChannel?.readyState === 'open') {
      await sendMessage(connection.dataChannel, message)
    }
  }, [connections])

  return {
    connections,
    connect,
    handleSignal,
    disconnect,
    sendMessage,
    error
  }
}