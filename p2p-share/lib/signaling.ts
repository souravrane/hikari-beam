'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { PeerInfo, SignalingMessage, UseSignalingReturn } from './types'

const SIGNALING_SERVER_URL = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'ws://localhost:3001'
const RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000

/**
 * Hook for managing Socket.IO signaling connection
 */
export function useSignaling(): UseSignalingReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [peers, setPeers] = useState<PeerInfo[]>([])
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reconnectAttempts = useRef(0)
  const messageCallbacks = useRef<Map<string, (data: any) => void>>(new Map())

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(SIGNALING_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY
    })

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to signaling server:', socketInstance.id)
      setIsConnected(true)
      setError(null)
      reconnectAttempts.current = 0
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from signaling server:', reason)
      setIsConnected(false)
      
      // If server disconnected us, try to reconnect
      if (reason === 'io server disconnect') {
        socketInstance.connect()
      }
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error)
      reconnectAttempts.current++
      
      if (reconnectAttempts.current >= RECONNECT_ATTEMPTS) {
        setError('Failed to connect to signaling server')
      }
    })

    // Room event handlers
    socketInstance.on('joined', (data: { roomId: string; peers: PeerInfo[]; isHost: boolean }) => {
      console.log('Joined room:', data)
      setRoomId(data.roomId)
      setPeers(data.peers)
      setIsHost(data.isHost)
      setError(null)
    })

    socketInstance.on('peer-joined', (peer: PeerInfo) => {
      console.log('Peer joined:', peer)
      setPeers(prev => [...prev, peer])
      
      // Notify callback if registered
      const callback = messageCallbacks.current.get('peer-joined')
      callback?.(peer)
    })

    socketInstance.on('peer-left', (peerId: string) => {
      console.log('Peer left:', peerId)
      setPeers(prev => prev.filter(p => p.id !== peerId))
      
      // Notify callback if registered
      const callback = messageCallbacks.current.get('peer-left')
      callback?.(peerId)
    })

    // Signaling message handlers
    socketInstance.on('signal', (data: { from: string; signal: SignalingMessage }) => {
      console.log('Received signal from:', data.from, data.signal.type)
      
      // Notify callback if registered
      const callback = messageCallbacks.current.get('signal')
      callback?.(data)
    })

    // Host status handlers
    socketInstance.on('host-status', (data: { isOnline: boolean }) => {
      console.log('Host status changed:', data)
      
      // Notify callback if registered
      const callback = messageCallbacks.current.get('host-status')
      callback?.(data)
    })

    socketInstance.on('host-rejoined', (data: { fileId?: string }) => {
      console.log('Host rejoined:', data)
      
      // Notify callback if registered
      const callback = messageCallbacks.current.get('host-rejoined')
      callback?.(data)
    })

    // Error handlers
    socketInstance.on('error', (message: string) => {
      console.error('Server error:', message)
      setError(message)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  // Join a room
  const joinRoom = useCallback((roomId: string) => {
    if (!socket || !isConnected) {
      setError('Not connected to signaling server')
      return
    }

    console.log('Joining room:', roomId)
    socket.emit('join', roomId)
  }, [socket, isConnected])

  // Send signaling message
  const sendSignal = useCallback((peerId: string, signal: SignalingMessage) => {
    if (!socket || !isConnected) {
      console.error('Cannot send signal: not connected')
      return
    }

    console.log('Sending signal to:', peerId, signal.type)
    socket.emit('signal', { to: peerId, signal })
  }, [socket, isConnected])

  // Register event callback
  const onMessage = useCallback((event: string, callback: (data: any) => void) => {
    messageCallbacks.current.set(event, callback)
    
    return () => {
      messageCallbacks.current.delete(event)
    }
  }, [])

  // Leave current room
  const leaveRoom = useCallback(() => {
    if (socket && roomId) {
      console.log('Leaving room:', roomId)
      socket.emit('leave', roomId)
      setRoomId(null)
      setPeers([])
      setIsHost(false)
    }
  }, [socket, roomId])

  // Get current connection status
  const getStatus = useCallback(() => {
    return {
      isConnected,
      roomId,
      peers,
      isHost,
      error
    }
  }, [isConnected, roomId, peers, isHost, error])

  return {
    socket,
    isConnected,
    roomId,
    peers,
    isHost,
    joinRoom,
    leaveRoom,
    sendSignal,
    onMessage,
    getStatus,
    error
  }
}

/**
 * Hook for managing P2P connections through signaling
 */
export function useP2PSignaling(roomId: string | null) {
  const signaling = useSignaling()
  const [connections, setConnections] = useState<Map<string, any>>(new Map())

  // Auto-join room when roomId changes
  useEffect(() => {
    if (roomId && signaling.isConnected) {
      signaling.joinRoom(roomId)
    }
  }, [roomId, signaling.isConnected, signaling.joinRoom])

  // Handle new peers joining
  useEffect(() => {
    const cleanup = signaling.onMessage('peer-joined', (peer: PeerInfo) => {
      console.log('New peer joined, initiating connection:', peer.id)
      // Connection initiation will be handled by P2P hooks
    })

    return cleanup
  }, [signaling])

  // Handle peers leaving
  useEffect(() => {
    const cleanup = signaling.onMessage('peer-left', (peerId: string) => {
      console.log('Peer left, cleaning up connection:', peerId)
      setConnections(prev => {
        const newConnections = new Map(prev)
        newConnections.delete(peerId)
        return newConnections
      })
    })

    return cleanup
  }, [signaling])

  // Handle host status changes
  useEffect(() => {
    const cleanup = signaling.onMessage('host-status', (data: { isOnline: boolean }) => {
      console.log('Host status changed:', data.isOnline)
      // This will be handled by file transfer hooks
    })

    return cleanup
  }, [signaling])

  // Handle host rejoin
  useEffect(() => {
    const cleanup = signaling.onMessage('host-rejoined', (data: { fileId?: string }) => {
      console.log('Host rejoined with file:', data.fileId)
      // This will be handled by file transfer hooks for resume logic
    })

    return cleanup
  }, [signaling])

  return {
    ...signaling,
    connections
  }
}

/**
 * Generate a random room ID
 */
export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Validate room ID format
 */
export function isValidRoomId(roomId: string): boolean {
  return /^[a-z0-9]{8}$/.test(roomId)
}