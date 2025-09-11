import { PeerConnection, P2PMessage, RTCConfiguration as P2PRTCConfiguration } from './types'

// WebRTC Configuration
const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

// DataChannel configuration  
const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
  label: 'file',
  ordered: true, // Reliable ordered delivery
  maxRetransmits: 3
}

// Buffer management constants
export const BUFFER_THRESHOLD = 65536 // 64KB
export const MAX_BUFFER_SIZE = BUFFER_THRESHOLD * 4 // 256KB

/**
 * Create a new RTCPeerConnection with proper configuration
 */
export function createPeerConnection(config?: RTCConfiguration): RTCPeerConnection {
  const rtcConfig = { ...DEFAULT_RTC_CONFIG, ...config }
  const pc = new RTCPeerConnection(rtcConfig)

  // Add connection state logging
  pc.onconnectionstatechange = () => {
    console.log(`Connection state: ${pc.connectionState}`)
  }

  pc.oniceconnectionstatechange = () => {
    console.log(`ICE connection state: ${pc.iceConnectionState}`)
  }

  return pc
}

/**
 * Create a data channel with backpressure handling
 */
export function createDataChannel(
  peerConnection: RTCPeerConnection,
  onMessage: (message: P2PMessage) => void,
  onOpen?: () => void,
  onError?: (error: Event) => void
): RTCDataChannel {
  const dataChannel = peerConnection.createDataChannel('file', DATA_CHANNEL_CONFIG)

  // Set up backpressure handling
  dataChannel.bufferedAmountLowThreshold = BUFFER_THRESHOLD

  dataChannel.onopen = () => {
    console.log('Data channel opened')
    onOpen?.()
  }

  dataChannel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as P2PMessage
      onMessage(message)
    } catch (error) {
      console.error('Failed to parse message:', error)
      onError?.(event)
    }
  }

  dataChannel.onerror = (event) => {
    console.error('Data channel error:', event)
    onError?.(event)
  }

  dataChannel.onclose = () => {
    console.log('Data channel closed')
  }

  return dataChannel
}

/**
 * Set up data channel event handlers for incoming connections
 */
export function setupIncomingDataChannel(
  dataChannel: RTCDataChannel,
  onMessage: (message: P2PMessage) => void,
  onOpen?: () => void,
  onError?: (error: Event) => void
): void {
  dataChannel.bufferedAmountLowThreshold = BUFFER_THRESHOLD

  dataChannel.onopen = () => {
    console.log('Incoming data channel opened')
    onOpen?.()
  }

  dataChannel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as P2PMessage
      onMessage(message)
    } catch (error) {
      console.error('Failed to parse incoming message:', error)
      onError?.(event)
    }
  }

  dataChannel.onerror = (event) => {
    console.error('Incoming data channel error:', event)
    onError?.(event)
  }

  dataChannel.onclose = () => {
    console.log('Incoming data channel closed')
  }
}

/**
 * Send a message through a data channel with backpressure handling
 */
export async function sendMessage(
  dataChannel: RTCDataChannel,
  message: P2PMessage
): Promise<void> {
  if (dataChannel.readyState !== 'open') {
    throw new Error('Data channel is not open')
  }

  const messageString = JSON.stringify(message)
  const messageSize = new Blob([messageString]).size

  // Check if buffer can handle the message
  if (dataChannel.bufferedAmount + messageSize > MAX_BUFFER_SIZE) {
    // Wait for buffer to drain
    await waitForBufferDrain(dataChannel)
  }

  dataChannel.send(messageString)
}

/**
 * Send binary data (chunk) with backpressure handling
 */
export async function sendChunk(
  dataChannel: RTCDataChannel,
  chunkIndex: number,
  data: ArrayBuffer
): Promise<void> {
  if (dataChannel.readyState !== 'open') {
    throw new Error('Data channel is not open')
  }

  // Create chunk message
  const chunkMessage: P2PMessage = {
    type: 'CHUNK',
    data: {
      index: chunkIndex,
      payload: Array.from(new Uint8Array(data)) // Convert to array for JSON
    },
    timestamp: Date.now()
  }

  await sendMessage(dataChannel, chunkMessage)
}

/**
 * Wait for data channel buffer to drain below threshold
 */
function waitForBufferDrain(dataChannel: RTCDataChannel): Promise<void> {
  return new Promise((resolve) => {
    const checkBuffer = () => {
      if (dataChannel.bufferedAmount <= BUFFER_THRESHOLD) {
        resolve()
      } else {
        // Wait for bufferedamountlow event
        dataChannel.addEventListener('bufferedamountlow', resolve, { once: true })
      }
    }
    checkBuffer()
  })
}

/**
 * Create WebRTC offer
 */
export async function createOffer(peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  return offer
}

/**
 * Create WebRTC answer
 */
export async function createAnswer(
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  await peerConnection.setRemoteDescription(offer)
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  return answer
}

/**
 * Handle WebRTC answer
 */
export async function handleAnswer(
  peerConnection: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await peerConnection.setRemoteDescription(answer)
}

/**
 * Handle ICE candidate
 */
export async function handleIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await peerConnection.addIceCandidate(candidate)
}

/**
 * Set up ICE candidate handling
 */
export function setupIceCandidateHandling(
  peerConnection: RTCPeerConnection,
  onIceCandidate: (candidate: RTCIceCandidate) => void
): void {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate)
    }
  }
}

/**
 * Clean up peer connection
 */
export function closePeerConnection(peerConnection: RTCPeerConnection): void {
  // Close all data channels
  const senders = peerConnection.getSenders()
  senders.forEach(sender => {
    if (sender.track) {
      sender.track.stop()
    }
  })

  // Close connection
  peerConnection.close()
}

/**
 * Check if WebRTC is supported
 */
export function isWebRTCSupported(): boolean {
  return !!(
    window.RTCPeerConnection &&
    window.RTCDataChannel &&
    navigator.mediaDevices
  )
}

/**
 * Get connection quality metrics
 */
export async function getConnectionStats(
  peerConnection: RTCPeerConnection
): Promise<{
  bytesSent: number
  bytesReceived: number
  packetsLost: number
  roundTripTime: number
}> {
  const stats = await peerConnection.getStats()
  let bytesSent = 0
  let bytesReceived = 0
  let packetsLost = 0
  let roundTripTime = 0

  stats.forEach((stat) => {
    if (stat.type === 'outbound-rtp') {
      bytesSent += stat.bytesSent || 0
      packetsLost += stat.packetsLost || 0
    } else if (stat.type === 'inbound-rtp') {
      bytesReceived += stat.bytesReceived || 0
    } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
      roundTripTime = stat.currentRoundTripTime || 0
    }
  })

  return { bytesSent, bytesReceived, packetsLost, roundTripTime }
}

/**
 * Monitor connection health
 */
export class ConnectionMonitor {
  private peerConnection: RTCPeerConnection
  private interval: NodeJS.Timeout | null = null
  private onHealthUpdate: (health: ConnectionHealth) => void

  constructor(
    peerConnection: RTCPeerConnection,
    onHealthUpdate: (health: ConnectionHealth) => void
  ) {
    this.peerConnection = peerConnection
    this.onHealthUpdate = onHealthUpdate
  }

  start(intervalMs: number = 5000): void {
    this.interval = setInterval(async () => {
      try {
        const stats = await getConnectionStats(this.peerConnection)
        const health: ConnectionHealth = {
          state: this.peerConnection.connectionState,
          iceState: this.peerConnection.iceConnectionState,
          ...stats,
          timestamp: Date.now()
        }
        this.onHealthUpdate(health)
      } catch (error) {
        console.error('Failed to get connection stats:', error)
      }
    }, intervalMs)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}

export interface ConnectionHealth {
  state: RTCPeerConnectionState
  iceState: RTCIceConnectionState
  bytesSent: number
  bytesReceived: number
  packetsLost: number
  roundTripTime: number
  timestamp: number
}