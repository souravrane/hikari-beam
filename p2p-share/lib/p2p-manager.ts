'use client'

import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { generateFileMetadata } from './chunking'
import { FileMetadata, P2PMessage } from './types'

const SIGNALING_SERVER = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'ws://localhost:3001'

export interface P2PConnection {
  peerId: string
  connection: RTCPeerConnection
  dataChannel: RTCDataChannel | null
  isHost: boolean
}

export function useP2PManager(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [peers, setPeers] = useState<string[]>([])
  const [isHost, setIsHost] = useState(false)
  const [connections, setConnections] = useState<Map<string, P2PConnection>>(new Map())
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [pendingMetadata, setPendingMetadata] = useState<FileMetadata | null>(null)
  const [transferProgress, setTransferProgress] = useState<Map<string, any>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const rtcConfig = {
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free TURN servers for better NAT traversal
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject', 
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  }

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(SIGNALING_SERVER, {
      transports: ['websocket', 'polling']
    })

    socketInstance.on('connect', () => {
      console.log('Connected to signaling server')
      setIsConnected(true)
      setError(null)
      
      // Join room
      socketInstance.emit('join', roomId)
    })

    socketInstance.on('joined', (data: { peers: any[], isHost: boolean }) => {
      console.log('Joined room:', data)
      setIsHost(data.isHost)
      setPeers(data.peers.map(p => p.id))
      
      // If we're not the host and there are existing peers, connect to them
      if (!data.isHost) {
        data.peers.forEach(peer => {
          if (peer.isHost) {
            createConnection(peer.id, false) // We don't initiate
          }
        })
      }
    })

    socketInstance.on('peer-joined', (peer: { id: string, isHost: boolean }) => {
      console.log('Peer joined:', peer)
      setPeers(prev => [...prev, peer.id])
      
      // If we're host, create connection to new peer
      if (isHost && !peer.isHost) {
        createConnection(peer.id, true) // We initiate
      }
    })

    socketInstance.on('peer-left', (peerId: string) => {
      console.log('Peer left:', peerId)
      setPeers(prev => prev.filter(id => id !== peerId))
      
      // Clean up connection
      const conn = connections.get(peerId)
      if (conn) {
        conn.connection.close()
        connections.delete(peerId)
        setConnections(new Map(connections))
      }
    })

    socketInstance.on('signal', ({ from, signal }: { from: string, signal: any }) => {
      console.log('Received signal from', from, signal.type)
      handleSignalingMessage(from, signal)
    })

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from signaling server')
      setIsConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [roomId])

  const createConnection = async (peerId: string, isInitiator: boolean) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig)
      let dataChannel: RTCDataChannel | null = null

      // Set up ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('signal', {
            to: peerId,
            signal: { type: 'ice', candidate: event.candidate }
          })
        }
      }

      if (isInitiator) {
        // Create data channel
        dataChannel = pc.createDataChannel('file', { ordered: true })
        setupDataChannel(dataChannel, peerId)
      } else {
        // Wait for data channel
        pc.ondatachannel = (event) => {
          dataChannel = event.channel
          setupDataChannel(dataChannel, peerId)
        }
      }

      const connection: P2PConnection = {
        peerId,
        connection: pc,
        dataChannel,
        isHost: isInitiator
      }

      setConnections(prev => new Map(prev.set(peerId, connection)))

      if (isInitiator) {
        // Create offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        if (socket) {
          socket.emit('signal', {
            to: peerId,
            signal: { type: 'offer', offer }
          })
        }
      }

    } catch (error) {
      console.error('Error creating connection:', error)
      setError('Failed to create connection')
    }
  }

  const setupDataChannel = (channel: RTCDataChannel, peerId: string) => {
    channel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`)
      
      // If we have a file to share and this is a new peer, send metadata
      if (fileMetadata && isHost) {
        sendFileMetadata(channel)
      }
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleDataChannelMessage(message, peerId, channel)
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error)
    }

    // Update connection object
    setConnections(prev => {
      const newConnections = new Map(prev)
      const conn = newConnections.get(peerId)
      if (conn) {
        conn.dataChannel = channel
        newConnections.set(peerId, conn)
      }
      return newConnections
    })
  }

  const handleSignalingMessage = async (from: string, signal: any) => {
    const conn = connections.get(from)
    if (!conn) return

    try {
      switch (signal.type) {
        case 'offer':
          await conn.connection.setRemoteDescription(signal.offer)
          const answer = await conn.connection.createAnswer()
          await conn.connection.setLocalDescription(answer)
          
          if (socket) {
            socket.emit('signal', {
              to: from,
              signal: { type: 'answer', answer }
            })
          }
          break

        case 'answer':
          await conn.connection.setRemoteDescription(signal.answer)
          break

        case 'ice':
          await conn.connection.addIceCandidate(signal.candidate)
          break
      }
    } catch (error) {
      console.error('Error handling signaling message:', error)
    }
  }

  const handleDataChannelMessage = (message: any, peerId: string, channel: RTCDataChannel) => {
    switch (message.type) {
      case 'file-metadata':
        // Peer received metadata, show dialog
        setPendingMetadata(message.data)
        break

      case 'file-accepted':
        // Peer accepted file, start sending
        if (currentFile && isHost) {
          sendFile(currentFile, peerId, channel)
        }
        break

      case 'chunk':
        // Received a chunk
        handleChunkReceived(message.data, peerId)
        break
    }
  }

  const sendFileMetadata = (channel: RTCDataChannel) => {
    if (!fileMetadata) return
    
    const message = {
      type: 'file-metadata',
      data: fileMetadata
    }
    
    if (channel.readyState === 'open') {
      channel.send(JSON.stringify(message))
    }
  }

  const sendFile = async (file: File, peerId: string, channel: RTCDataChannel) => {
    const chunkSize = 32 * 1024 // 32KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    console.log(`Sending file to ${peerId}: ${totalChunks} chunks`)
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      const arrayBuffer = await chunk.arrayBuffer()
      
      // Convert to base64 for JSON transmission
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      
      const message = {
        type: 'chunk',
        data: {
          index: i,
          data: base64,
          isLast: i === totalChunks - 1
        }
      }
      
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message))
        
        // Update progress
        setTransferProgress(prev => {
          const newProgress = new Map(prev)
          newProgress.set(peerId, {
            sent: i + 1,
            total: totalChunks,
            percentage: ((i + 1) / totalChunks) * 100
          })
          return newProgress
        })
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    console.log(`File sent to ${peerId}`)
  }

  const receivedChunks = useRef<Map<number, ArrayBuffer>>(new Map())

  const handleChunkReceived = (chunkData: any, peerId: string) => {
    const { index, data: base64Data, isLast } = chunkData
    
    // Convert from base64 back to ArrayBuffer
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    receivedChunks.current.set(index, bytes.buffer)
    
    // Update progress
    if (fileMetadata) {
      setTransferProgress(prev => {
        const newProgress = new Map(prev)
        newProgress.set('download', {
          received: receivedChunks.current.size,
          total: fileMetadata.totalChunks,
          percentage: (receivedChunks.current.size / fileMetadata.totalChunks) * 100
        })
        return newProgress
      })
    }
    
    // If this is the last chunk, assemble the file
    if (isLast && fileMetadata) {
      assembleAndDownloadFile()
    }
  }

  const assembleAndDownloadFile = () => {
    if (!fileMetadata) return
    
    const chunks: ArrayBuffer[] = []
    for (let i = 0; i < fileMetadata.totalChunks; i++) {
      const chunk = receivedChunks.current.get(i)
      if (chunk) {
        chunks.push(chunk)
      }
    }
    
    const blob = new Blob(chunks, { type: fileMetadata.type })
    const url = URL.createObjectURL(blob)
    
    // Create download link
    const a = document.createElement('a')
    a.href = url
    a.download = fileMetadata.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // Clean up
    URL.revokeObjectURL(url)
    receivedChunks.current.clear()
    
    console.log('File download completed!')
  }

  // API methods
  const shareFile = async (file: File) => {
    try {
      setCurrentFile(file)
      const metadata = await generateFileMetadata(file)
      setFileMetadata(metadata)
      setError(null)
      
      console.log('Sharing file:', metadata)
      
      // Send metadata to all connected peers
      connections.forEach((conn, peerId) => {
        if (conn.dataChannel?.readyState === 'open') {
          sendFileMetadata(conn.dataChannel)
        }
      })
      
    } catch (error) {
      console.error('Error sharing file:', error)
      setError('Failed to share file')
    }
  }

  const acceptFile = (metadata: FileMetadata) => {
    setPendingMetadata(null)
    setFileMetadata(metadata)
    receivedChunks.current.clear()
    
    // Send acceptance to host
    connections.forEach((conn, peerId) => {
      if (conn.dataChannel?.readyState === 'open') {
        const message = {
          type: 'file-accepted',
          data: { accepted: true }
        }
        conn.dataChannel.send(JSON.stringify(message))
      }
    })
    
    console.log('File accepted:', metadata.name)
  }

  const rejectFile = () => {
    setPendingMetadata(null)
  }

  return {
    isConnected,
    peers,
    isHost,
    error,
    currentFile,
    fileMetadata,
    pendingMetadata,
    transferProgress,
    shareFile,
    acceptFile,
    rejectFile
  }
}