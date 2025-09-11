# P2P File Sharing App - Development Guide

## Project Overview
Building a pure web P2P live file-sharing application with torrent-like behavior using WebRTC DataChannels and Socket.IO signaling.

## Architecture
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Signaling Server**: Node.js + Socket.IO (minimal)
- **P2P Transfer**: WebRTC DataChannels (STUN-only for MVP)
- **Storage**: IndexedDB for chunk persistence and resume functionality

## Key Features
- One seeder (host), multiple consumers (peers)
- Room-based sharing with shareable links
- Chunked streaming (32-64KB chunks)
- Pause/resume on host disconnect/rejoin
- Metadata preview before download
- Late joiner support
- Per-peer progress tracking

## Development Commands

### Frontend (Next.js)
```bash
# Setup (if starting fresh)
npx create-next-app@latest p2p-share --typescript --tailwind --app
cd p2p-share
npm install socket.io-client

# Development
npm run dev

# Build and production
npm run build
npm start

# Type checking and linting
npm run lint
npm run type-check  # if available
```

### Signaling Server
```bash
# Setup
cd signaling-server
npm install

# Development
npm run dev

# Production
NODE_ENV=production npm start
```

## Quick Start Guide

### 1. Install Dependencies
```bash
# Install frontend dependencies
cd p2p-share && npm install

# Install server dependencies  
cd ../signaling-server && npm install
```

### 2. Start Services
```bash
# Terminal 1: Start signaling server
cd signaling-server && npm start

# Terminal 2: Start frontend
cd p2p-share && npm run dev
```

### 3. Test the Application
1. Open http://localhost:3000
2. Click "Create New Room" or join existing room
3. As host: select and share a file
4. As peer: accept file and watch download progress

### 4. Multi-peer Testing
- Open multiple browser tabs/windows
- Join the same room from different tabs
- Test file sharing with multiple recipients

## File Structure

### Frontend (`p2p-share/`)
```
├── app/
│   ├── page.tsx                    # Landing/Join page
│   ├── r/[roomId]/page.tsx         # Room page
│   └── components/
│       ├── FileSelector.tsx        # Host file selection
│       ├── MetadataDialog.tsx      # File preview/accept dialog
│       ├── PeerList.tsx            # Per-peer progress
│       └── TransferControls.tsx    # Pause/resume controls
├── lib/
│   ├── signaling.ts                # Socket.IO client hook
│   ├── webrtc.ts                   # WebRTC P2P logic
│   ├── file-transfer.ts            # Sender/receiver hooks
│   ├── idb.ts                      # IndexedDB utilities
│   ├── chunking.ts                 # File chunking logic
│   └── types.ts                    # TypeScript definitions
└── public/
```

### Signaling Server (`signaling-server/`)
```
├── server.js                      # Main server file
├── room-manager.js                # Room state management
└── package.json
```

## Technical Specifications

### Chunking Strategy
- **Chunk Size**: 32-64KB (configurable)
- **File Reading**: File.slice() in loops
- **Identifier**: SHA256(name + size + firstNBytes) or UUID for MVP

### Bitfield Format
- **Type**: Uint8Array
- **Encoding**: 1 = have chunk, 0 = missing
- **Storage**: IndexedDB with fileId key

### WebRTC DataChannel Protocol
- **Label**: "file" (reliable ordered)
- **Backpressure**: bufferedAmountLowThreshold = 65536
- **Messages**: JSON control messages (META, BITFIELD, REQUEST, CHUNK, ACK, END)

### Socket.IO Events
- **Client → Server**: join(roomId), signal({to, data})
- **Server → Client**: joined(peers), signal({from, data}), hostStatus({isOnline}), hostRejoined({fileId})

### IndexedDB Schema
```typescript
// Object stores
stores: {
  chunks: { fileId: string, index: number, data: ArrayBuffer }
  files: { fileId: string, bitfield: Uint8Array, receivedCount: number, metadata: FileMetadata }
}
```

## Development Checkpoints

### Phase 1: Basic Infrastructure
1. ✅ Next.js app with routing
2. ✅ Socket.IO signaling connection
3. ✅ Basic WebRTC connection establishment

### Phase 2: File Transfer Core
4. ✅ File chunking and metadata extraction
5. ✅ Basic chunk sender/receiver
6. ✅ IndexedDB chunk storage

### Phase 3: Advanced Features
7. ✅ Backpressure handling
8. ✅ Resume protocol
9. ✅ Late joiner support

### Phase 4: UI/UX Polish
10. ✅ Metadata dialog
11. ✅ Per-peer progress
12. ✅ Room sharing UX

## Testing Strategy

### Multi-tab Testing
```bash
# Terminal 1: Start signaling server
cd signaling-server && node server.js

# Terminal 2: Start frontend
cd p2p-share && npm run dev

# Browser: Open multiple tabs to localhost:3000
```

### Test Scenarios
1. **Basic Transfer**: Host selects file, peer joins and downloads
2. **Network Throttling**: Chrome DevTools → Network → Slow 3G
3. **Host Disconnect**: Close host tab, verify peers pause
4. **Host Rejoin**: Reopen host tab with same room, verify resume
5. **Late Joiner**: Start transfer, add new peer mid-transfer
6. **Large File**: Test with 100MB+ files

## Security Considerations (Future)

### E2E Encryption (Phase 2)
- AES-GCM encryption at chunk level
- Key derived from URL fragment (#key) - never sent to server
- Key exchange via secure channel or pre-shared

### Integrity Verification
- Per-chunk SHA256 hashes in metadata
- Verify chunks on receipt
- Re-request corrupted chunks

## Performance Optimizations

### Chunking Strategy
- Adaptive chunk size based on connection quality
- Request windows (e.g., 64 chunks ahead)
- Priority queuing for missing chunks

### Connection Management
- TURN server integration for NAT traversal
- Multiple data channels for parallel transfer
- Connection health monitoring

## Implementation Status

### ✅ Completed Features
- **Frontend Application**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Signaling Server**: Node.js + Socket.IO for WebRTC signaling
- **Core P2P Transfer**: WebRTC DataChannels with chunked file transfer
- **UI Components**: File selector, metadata dialog, peer list, transfer controls
- **IndexedDB Storage**: Persistent chunk storage for resume capability
- **Backpressure Handling**: DataChannel buffer management with bufferedamountlow
- **Resume Protocol**: Pause/resume on host disconnect/reconnect
- **Room Management**: Shareable room links with peer discovery
- **Progress Tracking**: Real-time per-peer transfer progress
- **Error Handling**: Comprehensive error states and recovery

### 🏗️ Architecture Highlights
- **Chunked Streaming**: 32-64KB chunks with sequential transfer
- **Bitfield Protocol**: Efficient tracking of received chunks
- **WebRTC Direct**: Peer-to-peer transfer with STUN server support
- **Resume Logic**: Smart reconnection with missing chunk detection
- **Memory Efficient**: Streaming file processing without full memory load

### 📊 Technical Specifications
- **Chunk Size**: 32-64KB (adaptive based on file size)
- **Concurrency**: Configurable concurrent chunk requests
- **Storage**: IndexedDB for chunks and metadata persistence
- **Protocol**: JSON-based control messages over WebRTC
- **Browsers**: Modern browsers with WebRTC DataChannel support

## Known Limitations (MVP)
- STUN-only (no TURN servers for NAT traversal)
- No end-to-end encryption (planned for Phase 2)
- Single seeder per room (multi-seeder in Phase 3)
- Browser storage limits for large files
- Requires JavaScript enabled

## Next Steps & Future Work
See `FUTURE_ENHANCEMENTS.md` for detailed roadmap:

### Phase 2 (Security & Performance)
- **End-to-End Encryption**: AES-GCM with URL fragment keys
- **TURN Integration**: Better NAT traversal for challenging networks
- **Adaptive Chunking**: Dynamic chunk sizing based on connection quality
- **PWA Support**: Offline capability and mobile app experience

### Phase 3 (Scale & Advanced Features)  
- **Multi-Seeder**: BitTorrent-style distributed sharing
- **Load Balancing**: Distributed signaling server architecture
- **QoS Management**: Connection quality monitoring and optimization
- **Enterprise Features**: Analytics, monitoring, and management tools

## Documentation
- `TESTING.md` - Comprehensive testing scenarios and validation
- `FUTURE_ENHANCEMENTS.md` - Detailed roadmap and technical plans
- `signaling-server/README.md` - Server deployment and configuration