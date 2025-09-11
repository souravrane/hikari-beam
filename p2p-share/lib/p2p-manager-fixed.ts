'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { generateFileMetadata } from './chunking'
import { FileMetadata } from './types'

const SIGNALING_SERVER = process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'ws://localhost:3001'

export interface P2PConnection {
  peerId: string
  connection: RTCPeerConnection
  dataChannel: RTCDataChannel | null
  isHost: boolean
  pendingIceCandidates: RTCIceCandidate[]
}

export function useP2PManager(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [peers, setPeers] = useState<string[]>([])
  const [isHost, setIsHost] = useState(false)
  const [connections, setConnections] = useState<Map<string, P2PConnection>>(new Map())
  const [connectionStates, setConnectionStates] = useState<Map<string, string>>(new Map())
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [pendingMetadata, setPendingMetadata] = useState<FileMetadata | null>(null)
  const [transferProgress, setTransferProgress] = useState<Map<string, any>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const receivedChunks = useRef<Map<number, ArrayBuffer>>(new Map())
  
  // Refs for accessing current state in event handlers
  const socketRef = useRef<Socket | null>(null)
  const connectionsRef = useRef<Map<string, P2PConnection>>(new Map())
  const isHostRef = useRef(false)
  const fileMetadataRef = useRef<FileMetadata | null>(null)
  const currentFileRef = useRef<File | null>(null)

  const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }

  // Check host status immediately on mount and set it before socket connection
  useEffect(() => {
    const hostRoomKey = `p2p-host-${roomId}`
    const hostMetadataKey = `p2p-host-metadata-${roomId}`
    const storedHostStatus = localStorage.getItem(hostRoomKey) === 'true'
    const storedHostMetadata = localStorage.getItem(hostMetadataKey)
    
    if (storedHostStatus && storedHostMetadata) {
      console.log(`🚀 IMMEDIATE host status restoration from localStorage for room ${roomId}`)
      console.log(`🔍 Stored metadata: ${storedHostMetadata}`)
      setIsHost(true)
      isHostRef.current = true // Immediately set ref as well
    } else {
      console.log(`🔍 No stored host status found for room ${roomId}`)
      setIsHost(false)
      isHostRef.current = false
    }
  }, [roomId])

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(SIGNALING_SERVER, {
      transports: ['websocket', 'polling']
    })

    socketInstance.on('connect', () => {
      console.log('Connected to signaling server:', socketInstance.id)
      setIsConnected(true)
      setError(null)
      
      // Check if we were previously the host of this room
      const hostRoomKey = `p2p-host-${roomId}`
      const wasHost = localStorage.getItem(hostRoomKey) === 'true'
      
      console.log(`🔍 Checking host status for room ${roomId}: was host = ${wasHost}`)
      
      // Debug storage state before joining 
      console.log(`🔍 HOST STORAGE DEBUG for room ${roomId}:`)
      console.log(`  🏠 Current host room:`, localStorage.getItem('p2p-current-host-room'))
      console.log(`  🏅 Host status:`, localStorage.getItem(hostRoomKey))
      console.log(`  🏮 Host metadata:`, localStorage.getItem(`p2p-host-metadata-${roomId}`))
      console.log(`  ✅ Was host:`, wasHost)
      
      // Join room (with host preference if we were host before)
      socketInstance.emit('join', roomId, { preferHost: wasHost })
      console.log(`🚪 Joining room ${roomId} with preferHost: ${wasHost}`)
    })

    socketInstance.on('joined', (data: { peers: any[], isHost: boolean }) => {
      console.log('🏠 Joined room:', data)
      console.log('📊 My socket ID:', socketInstance.id)
      console.log('📊 All peers in room:', data.peers)
      
      // Check localStorage first for host status override
      const hostRoomKey = `p2p-host-${roomId}`
      const storedHostStatus = localStorage.getItem(hostRoomKey) === 'true'
      const storedHostMetadata = localStorage.getItem(`p2p-host-metadata-${roomId}`)
      
      // Use localStorage host status if we have unique metadata, otherwise use server response
      let finalIsHost = data.isHost
      
      if (storedHostStatus && storedHostMetadata) {
        console.log(`🔄 OVERRIDING server host status with localStorage: ${storedHostStatus}`)
        console.log(`🔍 Existing host metadata: ${storedHostMetadata}`)
        finalIsHost = true
        
        // Update host metadata with current session info (socket ID + timestamp)
        const hostMetadata = `${socketInstance.id}-${Date.now()}`
        localStorage.setItem(`p2p-host-metadata-${roomId}`, hostMetadata)
        console.log(`💾 Updated host metadata for current session: ${hostMetadata}`)
        
        // Inform server about host status override
        console.log(`📤 Informing server of host status override for room ${roomId}`)
      } else if (data.isHost) {
        // We're newly assigned as host by server, store metadata
        const hostMetadata = `${socketInstance.id}-${Date.now()}`
        localStorage.setItem(`p2p-host-metadata-${roomId}`, hostMetadata)
        console.log(`💾 New host assignment - stored metadata: ${hostMetadata}`)
      } else {
        console.log(`👤 Assigned as peer by server for room ${roomId}`)
      }
      
      setIsHost(finalIsHost)
      isHostRef.current = finalIsHost // Ensure ref is immediately updated
      
      // Store host status in localStorage for persistence
      localStorage.setItem(hostRoomKey, finalIsHost.toString())
      console.log(`💾 Stored host status: ${finalIsHost} for room ${roomId}`)
      
      // If we're the host, also store the current room ID
      if (finalIsHost) {
        localStorage.setItem('p2p-current-host-room', roomId)
        console.log(`💾 Stored current host room: ${roomId}`)
      }
      
      // Filter out ourselves from the peer list
      const otherPeers = data.peers.filter(p => p.id !== socketInstance.id)
      setPeers(otherPeers.map(p => p.id))
      
      console.log(`🎭 I am ${data.isHost ? 'HOST' : 'PEER'}, other peers:`, otherPeers.map(p => p.id))
      
      // Handle existing peers when joining
      if (otherPeers.length > 0) {
        if (data.isHost) {
          // I'm host joining existing room with peers - initiate connections
          console.log('🚀 I am host joining existing room, initiating connections...')
          otherPeers.forEach(peer => {
            if (!peer.isHost) {
              console.log(`⏰ Scheduling connection to peer ${peer.id} in 1 second`)
              setTimeout(() => {
                console.log(`🚀 Now creating connection to peer ${peer.id}`)
                createConnection(peer.id, true)
              }, 1000)
            }
          })
        } else {
          // I'm peer joining room with host - wait for host to initiate, but also be ready
          console.log('🎯 I am peer joining room with host, preparing for connection...')
          otherPeers.forEach(peer => {
            if (peer.isHost) {
              console.log(`⏰ Ready to receive connection from host ${peer.id}`)
            }
          })
        }
      }
    })

    socketInstance.on('peer-joined', (peer: { id: string, isHost: boolean }) => {
      console.log('👤 PEER-JOINED EVENT:', peer)
      console.log('👤 My current state:', { amIHost: isHostRef.current, socketId: socketInstance.id })
      setPeers(prev => [...prev, peer.id])
      
      // If we're host and a peer joined, initiate connection
      if (isHostRef.current && !peer.isHost) {
        console.log('🎯 I am HOST, initiating connection to new PEER:', peer.id)
        console.log('🔍 Host verification:', { 
          isHostRef: isHostRef.current, 
          peerIsHost: peer.isHost,
          socketId: socketRef.current?.id 
        })
        setTimeout(() => {
          console.log('🚀 Now creating connection to new peer:', peer.id)
          console.log('🔍 Socket state:', { 
            hasSocket: !!socketRef.current, 
            socketId: socketRef.current?.id,
            socketConnected: socketRef.current?.connected 
          })
          createConnection(peer.id, true)
        }, 500) // Small delay for stability
      }
      // If we're peer and host joined, wait for host to initiate
      else if (!isHostRef.current && peer.isHost) {
        console.log('🎯 I am PEER, HOST joined, waiting for connection from host')
      } else {
        console.log('🎯 Peer joined but not taking action:', { myHost: isHostRef.current, peerHost: peer.isHost })
      }
    })

    socketInstance.on('peer-left', (peerId: string) => {
      console.log('Peer left:', peerId)
      setPeers(prev => prev.filter(id => id !== peerId))
      
      // Clean up connection
      const conn = connections.get(peerId)
      if (conn) {
        conn.connection.close()
        setConnections(prev => {
          const newConnections = new Map(prev)
          newConnections.delete(peerId)
          return newConnections
        })
        setConnectionStates(prev => {
          const newStates = new Map(prev)
          newStates.delete(peerId)
          return newStates
        })
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

  // Update refs when state changes
  useEffect(() => {
    socketRef.current = socket
  }, [socket])
  
  useEffect(() => {
    connectionsRef.current = connections
  }, [connections])
  
  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])
  
  useEffect(() => {
    fileMetadataRef.current = fileMetadata
  }, [fileMetadata])
  
  useEffect(() => {
    currentFileRef.current = currentFile
  }, [currentFile])

  const createConnection = useCallback(async (peerId: string, isInitiator: boolean) => {
    console.log(`🔧 Creating connection to ${peerId} (initiator: ${isInitiator})`)
    
    try {
      console.log(`🔧 Starting RTCPeerConnection creation for ${peerId}`)
      const pc = new RTCPeerConnection(rtcConfig)
      
      // Set up connection state handlers
      pc.onconnectionstatechange = () => {
        console.log(`🔄 Connection to ${peerId} state changed:`, pc.connectionState)
        setConnectionStates(prev => new Map(prev.set(peerId, pc.connectionState)))
        
        if (pc.connectionState === 'failed') {
          console.error(`❌ Connection to ${peerId} failed`)
        } else if (pc.connectionState === 'connected') {
          console.log(`✅ Connection to ${peerId} established successfully`)
        }
      }
      
      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection to ${peerId} state changed:`, pc.iceConnectionState)
        // Also track ICE connection state
        setConnectionStates(prev => new Map(prev.set(peerId, `${pc.connectionState} (ICE: ${pc.iceConnectionState})`)))
        
        if (pc.iceConnectionState === 'failed') {
          console.error(`❌ ICE connection to ${peerId} failed`)
        } else if (pc.iceConnectionState === 'connected') {
          console.log(`✅ ICE connection to ${peerId} established`)
        }
      }
      
      pc.onicegatheringstatechange = () => {
        console.log(`🔍 ICE gathering state for ${peerId}:`, pc.iceGatheringState)
      }
      
      pc.onsignalingstatechange = () => {
        console.log(`📡 Signaling state for ${peerId}:`, pc.signalingState)
      }

      // Set up ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log(`Sending ICE candidate to ${peerId}`)
          socketRef.current.emit('signal', {
            to: peerId,
            signal: { type: 'ice', candidate: event.candidate }
          })
        }
      }

      let dataChannel: RTCDataChannel | null = null

      if (isInitiator) {
        // Create data channel (host initiates)
        console.log(`Creating data channel to ${peerId}`)
        dataChannel = pc.createDataChannel('file', { ordered: true })
        setupDataChannel(dataChannel, peerId)
      } else {
        // Wait for data channel (peer waits)
        console.log(`Waiting for data channel from ${peerId}`)
        pc.ondatachannel = (event) => {
          console.log(`Received data channel from ${peerId}`)
          dataChannel = event.channel
          setupDataChannel(dataChannel, peerId)
        }
      }

      const connection: P2PConnection = {
        peerId,
        connection: pc,
        dataChannel,
        isHost: isInitiator,
        pendingIceCandidates: []
      }

      setConnections(prev => new Map(prev.set(peerId, connection)))
      // Also update the ref immediately for synchronous access
      connectionsRef.current.set(peerId, connection)
      console.log(`💾 Connection stored for ${peerId}, total connections: ${connections.size + 1}`)

      if (isInitiator) {
        // Create offer
        console.log(`🚀 Creating offer for ${peerId}`)
        const offer = await pc.createOffer()
        console.log(`📋 Offer created for ${peerId}:`, offer.type)
        await pc.setLocalDescription(offer)
        console.log(`✅ Local description set for ${peerId}`)
        
        if (socketRef.current) {
          console.log(`📤 Sending offer to ${peerId} via socket`)
          socketRef.current.emit('signal', {
            to: peerId,
            signal: { type: 'offer', offer }
          })
          console.log(`📤 Offer sent to ${peerId}`)
        } else {
          console.error(`❌ No socket available to send offer to ${peerId}`)
        }
      }

    } catch (error) {
      console.error(`❌ Error creating connection to ${peerId}:`, error)
      setError(`Failed to create connection to ${peerId}`)
    }
  }, [])

  const setupDataChannel = (channel: RTCDataChannel, peerId: string) => {
    console.log(`Setting up data channel with ${peerId}`)
    
    channel.onopen = () => {
      console.log(`✅ Data channel opened with ${peerId}`)
      console.log(`🔍 Current state - isHost: ${isHostRef.current}, hasFile: ${!!fileMetadataRef.current}`)
      
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
      
      // If we have a file to share and this is a new peer, send metadata
      if (fileMetadataRef.current && isHostRef.current) {
        console.log(`📤 Auto-sending file metadata to newly connected peer ${peerId}`)
        sendFileMetadata(channel)
      }
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log(`Message from ${peerId}:`, message.type)
        handleDataChannelMessage(message, peerId, channel)
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    }

    channel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error)
    }

    channel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`)
    }
  }

  const handleSignalingMessage = useCallback(async (from: string, signal: any) => {
    console.log(`📨 Handling signaling message from ${from}:`, signal.type)
    
    let conn = connectionsRef.current.get(from)
    
    // If we don't have a connection yet, create one (this happens when peer receives offer)
    if (!conn && signal.type === 'offer') {
      console.log(`🔗 Creating connection for incoming offer from ${from}`)
      try {
        await createConnection(from, false)
        conn = connectionsRef.current.get(from)
        
        if (!conn) {
          console.error(`❌ Failed to create connection for ${from} - connection not found after creation`)
          return
        }
        console.log(`✅ Successfully created connection for ${from}`)
      } catch (error) {
        console.error(`❌ Error creating connection for offer from ${from}:`, error)
        return
      }
    }
    
    if (!conn) {
      console.error(`❌ No connection found for ${from} and signal type is ${signal.type}`)
      return
    }
    
    console.log(`🔍 Connection state before handling ${signal.type}:`, {
      connectionState: conn.connection.connectionState,
      signalingState: conn.connection.signalingState,
      iceConnectionState: conn.connection.iceConnectionState
    })

    try {
      switch (signal.type) {
        case 'offer':
          console.log(`Received offer from ${from}`)
          await conn.connection.setRemoteDescription(signal.offer)
          
          // Process any queued ICE candidates
          await processQueuedIceCandidates(conn)
          
          const answer = await conn.connection.createAnswer()
          await conn.connection.setLocalDescription(answer)
          
          if (socketRef.current) {
            socketRef.current.emit('signal', {
              to: from,
              signal: { type: 'answer', answer }
            })
          }
          break

        case 'answer':
          console.log(`Received answer from ${from}`)
          await conn.connection.setRemoteDescription(signal.answer)
          
          // Process any queued ICE candidates
          await processQueuedIceCandidates(conn)
          break

        case 'ice':
          console.log(`Received ICE candidate from ${from}`)
          // Check if remote description is set before adding ICE candidate
          if (conn.connection.remoteDescription) {
            await conn.connection.addIceCandidate(signal.candidate)
          } else {
            console.log(`Queuing ICE candidate from ${from} (no remote description yet)`)
            conn.pendingIceCandidates.push(signal.candidate)
          }
          break
      }
    } catch (error) {
      console.error('Error handling signaling message:', error)
    }
  }, [createConnection])

  const processQueuedIceCandidates = async (conn: P2PConnection) => {
    console.log(`Processing ${conn.pendingIceCandidates.length} queued ICE candidates for ${conn.peerId}`)
    
    for (const candidate of conn.pendingIceCandidates) {
      try {
        await conn.connection.addIceCandidate(candidate)
        console.log(`Added queued ICE candidate for ${conn.peerId}`)
      } catch (error) {
        console.error(`Error adding queued ICE candidate for ${conn.peerId}:`, error)
      }
    }
    
    // Clear the queue
    conn.pendingIceCandidates = []
  }

  const handleDataChannelMessage = (message: any, peerId: string, channel: RTCDataChannel) => {
    console.log(`Data channel message from ${peerId}:`, message.type)
    
    switch (message.type) {
      case 'file-metadata':
        console.log('📄 Received file metadata:', message.data)
        setPendingMetadata(message.data)
        break

      case 'file-accepted':
        console.log('✅ Peer accepted file')
        console.log('🔍 File transfer check:', {
          hasCurrentFile: !!currentFileRef.current,
          isHost: isHostRef.current,
          fileName: currentFileRef.current?.name,
          fileSize: currentFileRef.current?.size
        })
        if (currentFileRef.current && isHostRef.current) {
          console.log('🚀 Starting file transfer...')
          sendFile(currentFileRef.current, peerId, channel)
        } else {
          console.log('❌ Cannot start file transfer:', {
            currentFile: !!currentFileRef.current,
            isHost: isHostRef.current
          })
        }
        break

      case 'chunk':
        console.log(`📦 Received chunk ${message.data.index}`)
        handleChunkReceived(message.data, peerId)
        break
    }
  }

  const sendFileMetadata = (channel: RTCDataChannel) => {
    if (!fileMetadataRef.current) return
    
    const message = {
      type: 'file-metadata',
      data: fileMetadataRef.current
    }
    
    if (channel.readyState === 'open') {
      console.log('📤 Sending file metadata')
      channel.send(JSON.stringify(message))
    } else {
      console.log('⚠️ Data channel not open, cannot send metadata')
    }
  }

  const sendFile = async (file: File, peerId: string, channel: RTCDataChannel) => {
    const chunkSize = 32 * 1024 // 32KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    console.log(`📤 Sending file to ${peerId}: ${file.name} (${file.size} bytes, ${totalChunks} chunks)`)
    console.log(`🔍 Channel state:`, channel.readyState)
    
    if (channel.readyState !== 'open') {
      console.error(`❌ Cannot send file: data channel is ${channel.readyState}`)
      return
    }
    
    // Initialize progress
    setTransferProgress(prev => {
      const newProgress = new Map(prev)
      newProgress.set(peerId, {
        sent: 0,
        total: totalChunks,
        percentage: 0,
        status: 'starting',
        receivedBytes: 0, // Changed from bytesTransferred
        totalBytes: file.size,
        speed: 0,
        eta: 0
      })
      return newProgress
    })
    
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
        const currentProgress = {
          sent: i + 1,
          total: totalChunks,
          percentage: ((i + 1) / totalChunks) * 100,
          status: i === totalChunks - 1 ? 'completed' : 'uploading',
          receivedBytes: (i + 1) * chunkSize, // Changed from bytesTransferred
          totalBytes: file.size,
          speed: 0, // Could calculate this if needed
          eta: 0 // Could calculate this if needed
        }
        
        console.log(`📊 Upload progress to ${peerId}: ${currentProgress.sent}/${currentProgress.total} chunks (${currentProgress.percentage.toFixed(1)}%)`)
        
        setTransferProgress(prev => {
          const newProgress = new Map(prev)
          newProgress.set(peerId, currentProgress)
          return newProgress
        })
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    console.log(`✅ File sent to ${peerId} - ${totalChunks} chunks transferred successfully`)
    
    // Mark transfer as completed
    setTransferProgress(prev => {
      const newProgress = new Map(prev)
      const currentProgress = newProgress.get(peerId)
      if (currentProgress) {
        newProgress.set(peerId, {
          ...currentProgress,
          status: 'completed',
          percentage: 100
        })
      }
      return newProgress
    })
  }

  const handleChunkReceived = (chunkData: any, peerId: string) => {
    const { index, data: base64Data, isLast } = chunkData
    
    console.log(`📦 Processing chunk ${index}, isLast: ${isLast}, total chunks expected: ${fileMetadataRef.current?.totalChunks}`)
    
    // Convert from base64 back to ArrayBuffer
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    receivedChunks.current.set(index, bytes.buffer)
    console.log(`💾 Stored chunk ${index}, total received: ${receivedChunks.current.size}`)
    
    // Update progress
    if (fileMetadataRef.current) {
      const chunkSize = 32 * 1024 // 32KB chunks
      const progress = {
        received: receivedChunks.current.size,
        total: fileMetadataRef.current.totalChunks,
        percentage: (receivedChunks.current.size / fileMetadataRef.current.totalChunks) * 100,
        status: receivedChunks.current.size === fileMetadataRef.current.totalChunks ? 'completed' : 'downloading',
        receivedBytes: receivedChunks.current.size * chunkSize, // Changed from bytesTransferred
        totalBytes: fileMetadataRef.current.size,
        speed: 0, // Could calculate this if needed
        eta: 0 // Could calculate this if needed
      }
      console.log(`📊 Download progress: ${progress.received}/${progress.total} chunks (${progress.percentage.toFixed(1)}%)`)
      
      setTransferProgress(prev => {
        const newProgress = new Map(prev)
        newProgress.set('download', progress)
        return newProgress
      })
    }
    
    // If this is the last chunk, assemble the file
    console.log(`🔍 Checking if should assemble: isLast=${isLast}, hasFileMetadata=${!!fileMetadataRef.current}`)
    if (isLast && fileMetadataRef.current) {
      console.log('🚀 Triggering file assembly...')
      assembleAndDownloadFile()
    } else if (isLast) {
      console.log('⚠️ Last chunk but no file metadata!')
    } else if (fileMetadataRef.current) {
      console.log('📄 Have metadata but not last chunk yet')
    }
  }

  const assembleAndDownloadFile = () => {
    if (!fileMetadataRef.current) return
    
    console.log('🔧 Assembling file...')
    const chunks: ArrayBuffer[] = []
    for (let i = 0; i < fileMetadataRef.current.totalChunks; i++) {
      const chunk = receivedChunks.current.get(i)
      if (chunk) {
        chunks.push(chunk)
      }
    }
    
    const blob = new Blob(chunks, { type: fileMetadataRef.current.type })
    const url = URL.createObjectURL(blob)
    
    // Create download link
    const a = document.createElement('a')
    a.href = url
    a.download = fileMetadataRef.current.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // Clean up
    URL.revokeObjectURL(url)
    receivedChunks.current.clear()
    
    console.log('✅ File download completed!')
  }

  // API methods
  const shareFile = async (file: File) => {
    try {
      console.log('🚀 Starting file share:', file.name)
      setCurrentFile(file)
      currentFileRef.current = file // Update ref immediately for synchronous access
      const metadata = await generateFileMetadata(file)
      setFileMetadata(metadata)
      setError(null)
      
      console.log('📋 Generated metadata:', metadata)
      
      // Send metadata to all connected peers with open data channels immediately
      let sentToCount = 0
      console.log(`🔍 Checking ${connections.size} connections for ready data channels`)
      
      connections.forEach((conn, peerId) => {
        console.log(`🔍 Connection to ${peerId}:`, {
          hasDataChannel: !!conn.dataChannel,
          dataChannelState: conn.dataChannel?.readyState,
          peerConnectionState: conn.connection.connectionState,
          iceConnectionState: conn.connection.iceConnectionState
        })
        
        if (conn.dataChannel?.readyState === 'open') {
          console.log(`📤 Sending metadata to ${peerId}`)
          sendFileMetadata(conn.dataChannel)
          sentToCount++
        } else {
          console.log(`⏳ Data channel to ${peerId} not ready yet:`, conn.dataChannel?.readyState)
        }
      })
      
      console.log(`📤 Metadata sent to ${sentToCount} peers out of ${connections.size} connections`)
      
      if (sentToCount === 0 && connections.size > 0) {
        console.log('⏳ No peers ready yet, metadata will be sent automatically when data channels open')
        
        // Debug: Show detailed connection diagnostics
        console.log('🔍 DIAGNOSTIC - Connection Details:')
        connections.forEach((conn, peerId) => {
          console.log(`  Peer ${peerId}:`, {
            signalingState: conn.connection.signalingState,
            connectionState: conn.connection.connectionState,
            iceConnectionState: conn.connection.iceConnectionState,
            iceGatheringState: conn.connection.iceGatheringState,
            hasLocalDescription: !!conn.connection.localDescription,
            hasRemoteDescription: !!conn.connection.remoteDescription,
            dataChannelState: conn.dataChannel?.readyState,
            pendingIceCandidates: conn.pendingIceCandidates.length
          })
        })
      }
      
    } catch (error) {
      console.error('Error sharing file:', error)
      setError('Failed to share file')
    }
  }

  const acceptFile = (metadata: FileMetadata) => {
    console.log('✅ Accepting file:', metadata.name)
    setPendingMetadata(null)
    setFileMetadata(metadata)
    fileMetadataRef.current = metadata // Update ref immediately for synchronous access
    receivedChunks.current.clear()
    
    // Initialize download progress
    setTransferProgress(prev => {
      const newProgress = new Map(prev)
      newProgress.set('download', {
        received: 0,
        total: metadata.totalChunks,
        percentage: 0,
        status: 'starting',
        receivedBytes: 0, // Changed from bytesTransferred
        totalBytes: metadata.size,
        speed: 0,
        eta: 0
      })
      return newProgress
    })
    
    // Send acceptance to host
    connections.forEach((conn, peerId) => {
      if (conn.dataChannel?.readyState === 'open') {
        const message = {
          type: 'file-accepted',
          data: { accepted: true }
        }
        console.log(`📤 Sending file acceptance to ${peerId}`)
        conn.dataChannel.send(JSON.stringify(message))
      }
    })
  }

  const rejectFile = () => {
    console.log('❌ Rejecting file')
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
    connections,
    connectionStates,
    shareFile,
    acceptFile,
    rejectFile
  }
}

// Utility functions for room management
export const getStoredHostRoom = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('p2p-current-host-room')
}

export const clearStoredHostRoom = () => {
  if (typeof window === 'undefined') return
  const currentRoom = localStorage.getItem('p2p-current-host-room')
  localStorage.removeItem('p2p-current-host-room')
  
  // Also clear host status and metadata for the current room
  if (currentRoom) {
    localStorage.removeItem(`p2p-host-${currentRoom}`)
    localStorage.removeItem(`p2p-host-metadata-${currentRoom}`)
    console.log(`🧹 Cleared host data for room: ${currentRoom}`)
  }
}

export const isStoredHostForRoom = (roomId: string): boolean => {
  if (typeof window === 'undefined') return false
  const hostRoomKey = `p2p-host-${roomId}`
  const hostMetadataKey = `p2p-host-metadata-${roomId}`
  
  const isHost = localStorage.getItem(hostRoomKey) === 'true'
  const hasMetadata = localStorage.getItem(hostMetadataKey) !== null
  
  console.log(`🔍 Checking stored host status for room ${roomId}:`, {
    isHost,
    hasMetadata,
    metadata: localStorage.getItem(hostMetadataKey),
    finalResult: isHost && hasMetadata
  })
  
  return isHost && hasMetadata
}

export const debugHostStorage = (roomId: string): void => {
  if (typeof window === 'undefined') {
    console.log('🚫 Cannot debug storage: not in browser environment')
    return
  }
  
  const hostRoomKey = `p2p-host-${roomId}`
  const hostMetadataKey = `p2p-host-metadata-${roomId}`
  const currentHostRoom = 'p2p-current-host-room'
  
  console.log(`🔍 HOST STORAGE DEBUG for room ${roomId}:`)
  console.log(`  🏠 Current host room:`, localStorage.getItem(currentHostRoom))
  console.log(`  🏅 Host status:`, localStorage.getItem(hostRoomKey))
  console.log(`  🏮 Host metadata:`, localStorage.getItem(hostMetadataKey))
  console.log(`  ✅ Is stored host:`, isStoredHostForRoom(roomId))
  
  // List all p2p related localStorage keys
  const allKeys = Object.keys(localStorage).filter(key => key.startsWith('p2p-'))
  console.log(`  🗾 All P2P localStorage keys:`, allKeys)
}