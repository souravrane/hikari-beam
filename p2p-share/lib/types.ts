// Core WebRTC and P2P Types
export interface RTCConfiguration {
  iceServers: RTCIceServer[]
}

export interface PeerConnection {
  id: string
  connection: RTCPeerConnection | null
  dataChannel: RTCDataChannel | null
  state: 'connecting' | 'connected' | 'disconnected' | 'failed'
}

// File Transfer Types
export interface FileMetadata {
  fileId: string
  name: string
  size: number
  type: string
  chunkSize: number
  totalChunks: number
  sha256?: string // Optional for MVP
  createdAt: number
}

export interface ChunkInfo {
  index: number
  size: number
  offset: number
}

export interface FileChunk {
  fileId: string
  index: number
  data: ArrayBuffer
  hash?: string // Optional for MVP
}

export interface BitfieldInfo {
  fileId: string
  bitfield: Uint8Array
  receivedCount: number
  totalChunks: number
  lastUpdated: number
}

// P2P Protocol Messages
export type P2PMessageType = 
  | 'META'           // Send file metadata
  | 'BITFIELD'       // Send/request bitfield
  | 'REQUEST'        // Request chunk range
  | 'CHUNK'          // Send chunk data
  | 'ACK'            // Acknowledge chunk received
  | 'NEED'           // Request missing chunks (resume)
  | 'END'            // Transfer complete
  | 'ERROR'          // Error occurred

export interface P2PMessage {
  type: P2PMessageType
  data: any
  timestamp: number
}

export interface MetaMessage extends P2PMessage {
  type: 'META'
  data: FileMetadata
}

export interface BitfieldMessage extends P2PMessage {
  type: 'BITFIELD'
  data: {
    bitfield: number[] // Convert Uint8Array to array for JSON
    receivedCount: number
  }
}

export interface RequestMessage extends P2PMessage {
  type: 'REQUEST'
  data: {
    startIndex: number
    endIndex: number
  }
}

export interface ChunkMessage extends P2PMessage {
  type: 'CHUNK'
  data: {
    index: number
    payload: ArrayBuffer
  }
}

export interface AckMessage extends P2PMessage {
  type: 'ACK'
  data: {
    index: number
  }
}

export interface NeedMessage extends P2PMessage {
  type: 'NEED'
  data: {
    missingRanges: { start: number; end: number }[]
  }
}

// Signaling Types
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate'
  data: any
}

export interface SocketEvents {
  // Client to Server
  join: (roomId: string) => void
  signal: (data: { to: string; signal: SignalingMessage }) => void
  
  // Server to Client
  joined: (data: { roomId: string; peers: PeerInfo[]; isHost: boolean }) => void
  'peer-joined': (peer: PeerInfo) => void
  'peer-left': (peerId: string) => void
  signal: (data: { from: string; signal: SignalingMessage }) => void
  'host-status': (data: { isOnline: boolean }) => void
  'host-rejoined': (data: { fileId?: string }) => void
  error: (message: string) => void
}

export interface PeerInfo {
  id: string
  isHost: boolean
  joinedAt: number
}

// Transfer Progress Types
export interface TransferProgress {
  fileId: string
  peerId: string
  receivedChunks: number
  totalChunks: number
  receivedBytes: number
  totalBytes: number
  speed: number // bytes per second
  eta: number // estimated time remaining in seconds
  status: 'waiting' | 'downloading' | 'paused' | 'completed' | 'error'
  error?: string
}

export interface GlobalProgress {
  fileId: string
  totalPeers: number
  completedPeers: number
  activePeers: number
  avgSpeed: number
  totalBytes: number
  transferredBytes: number
}

// IndexedDB Types
export interface ChunkRecord {
  fileId: string
  index: number
  data: ArrayBuffer
  timestamp: number
}

export interface FileRecord {
  fileId: string
  metadata: FileMetadata
  bitfield: Uint8Array
  receivedCount: number
  createdAt: number
  lastAccessed: number
}

// UI State Types
export interface UIState {
  isHost: boolean
  roomId: string
  selectedFile: File | null
  fileMetadata: FileMetadata | null
  transferProgress: Map<string, TransferProgress>
  peers: Map<string, PeerConnection>
  isTransferActive: boolean
  showMetadataDialog: boolean
  error: string | null
}

// Room Types
export interface Room {
  id: string
  hostId: string
  peers: Set<string>
  fileId?: string
  createdAt: number
}

// Configuration Types
export interface AppConfig {
  chunkSize: number // 32KB - 64KB
  maxConcurrentRequests: number
  requestWindowSize: number // How many chunks to request ahead
  bufferThreshold: number // DataChannel buffer threshold
  iceServers: RTCIceServer[]
  reconnectAttempts: number
  reconnectDelay: number
}

// Hook Return Types
export interface UseSignalingReturn {
  socket: any
  isConnected: boolean
  roomId: string | null
  peers: PeerInfo[]
  isHost: boolean
  joinRoom: (roomId: string) => void
  error: string | null
}

export interface UseP2PReturn {
  connections: Map<string, PeerConnection>
  connect: (peerId: string) => Promise<void>
  sendMessage: (peerId: string, message: P2PMessage) => Promise<void>
  disconnect: (peerId: string) => void
  error: string | null
}

export interface UseFileSenderReturn {
  startTransfer: (file: File) => Promise<void>
  pauseTransfer: () => void
  resumeTransfer: () => void
  progress: GlobalProgress | null
  isActive: boolean
  error: string | null
}

export interface UseFileReceiverReturn {
  acceptFile: (metadata: FileMetadata) => Promise<void>
  pauseTransfer: () => void
  resumeTransfer: () => void
  progress: TransferProgress | null
  downloadedFile: Blob | null
  error: string | null
}

// Utility Types
export type BitfieldArray = Uint8Array
export type ChunkIndex = number
export type PeerId = string
export type RoomId = string
export type FileId = string

// Error Types
export interface P2PError extends Error {
  code: string
  peerId?: string
  fileId?: string
}