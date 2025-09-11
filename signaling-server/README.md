# P2P Signaling Server

A minimal WebRTC signaling server for peer-to-peer file sharing applications.

## Features

- Room-based peer management
- WebRTC signaling relay (offer/answer/ICE candidates)
- Host/peer role management
- Connection state tracking
- Automatic room cleanup
- Health monitoring endpoints

## Installation

```bash
npm install
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on port 3001 by default.

## API Endpoints

### Health Check
`GET /health` - Server health and basic stats

### Room Statistics  
`GET /stats` - Detailed room and connection statistics

## Socket.IO Events

### Client → Server

- `join(roomId)` - Join a room
- `leave(roomId)` - Leave a room
- `signal({to, signal})` - Send signaling message to peer
- `file-status(data)` - Update file sharing status
- `host-reconnect({roomId, fileId})` - Reconnect as host

### Server → Client

- `joined({roomId, peers, isHost})` - Successfully joined room
- `peer-joined(peer)` - New peer joined room
- `peer-left(peerId)` - Peer left room
- `signal({from, signal})` - Signaling message from peer
- `host-status({isOnline})` - Host connection status
- `host-rejoined({fileId})` - Host reconnected
- `error(message)` - Error message

## Configuration

Environment variables:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## Security Notes

- CORS is configured for localhost development
- For production, update CORS origins appropriately
- Consider adding rate limiting and authentication
- Monitor room creation to prevent abuse

## Room Management

Rooms are automatically created when first peer joins and cleaned up when empty. Host is assigned to first peer, and reassigned if host disconnects.

Maximum room age: 24 hours of inactivity