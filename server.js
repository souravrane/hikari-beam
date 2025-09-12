const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Initialize Express app
const expressApp = express();
const server = createServer(expressApp);

// CORS configuration
expressApp.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      /\.railway\.app$/, // Allow Railway domains
      /\.vercel\.app$/, // Allow Vercel domains
      /\.netlify\.app$/, // Allow Netlify domains
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      /\.railway\.app$/, // Allow Railway domains
      /\.vercel\.app$/, // Allow Vercel domains
      /\.netlify\.app$/, // Allow Netlify domains
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Room and peer management (same as signaling-server/server.js)
const rooms = new Map();
const peerToRoom = new Map();

function createRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      host: null,
      peers: new Set(),
      fileId: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });
  }
  return rooms.get(roomId);
}

function addPeerToRoom(roomId, socketId, isHost = false) {
  const room = createRoom(roomId);

  if (room.peers.size === 0) {
    room.host = socketId;
  } else if (isHost && room.host !== socketId) {
    const currentHostInRoom = room.peers.has(room.host);
    if (!currentHostInRoom) {
      room.host = socketId;
    }
  }

  room.peers.add(socketId);
  room.lastActivity = Date.now();
  peerToRoom.set(socketId, roomId);

  return room;
}

function removePeerFromRoom(socketId) {
  const roomId = peerToRoom.get(socketId);
  if (!roomId) return null;

  const room = rooms.get(roomId);
  if (!room) return null;

  room.peers.delete(socketId);
  peerToRoom.delete(socketId);

  if (room.host === socketId && room.peers.size > 0) {
    room.host = room.peers.values().next().value;
  }

  if (room.peers.size === 0) {
    rooms.delete(roomId);
    return null;
  }

  room.lastActivity = Date.now();
  return room;
}

function getRoomPeers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  return Array.from(room.peers).map((peerId) => ({
    id: peerId,
    isHost: peerId === room.host,
    joinedAt: Date.now(),
  }));
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join", (roomId, options = {}) => {
    try {
      if (!roomId || typeof roomId !== "string" || roomId.length !== 8) {
        socket.emit("error", "Invalid room ID");
        return;
      }

      const currentRoomId = peerToRoom.get(socket.id);
      if (currentRoomId) {
        socket.leave(currentRoomId);
        removePeerFromRoom(socket.id);
      }

      socket.join(roomId);
      const room = addPeerToRoom(
        roomId,
        socket.id,
        options.preferHost || false
      );
      const peers = getRoomPeers(roomId);
      const isHost = room.host === socket.id;

      socket.emit("joined", {
        roomId,
        peers: peers.filter((p) => p.id !== socket.id),
        isHost,
      });

      socket.to(roomId).emit("peer-joined", {
        id: socket.id,
        isHost,
        joinedAt: Date.now(),
      });
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", "Failed to join room");
    }
  });

  socket.on("leave", (roomId) => {
    try {
      socket.leave(roomId);
      const room = removePeerFromRoom(socket.id);

      if (room) {
        socket.to(roomId).emit("peer-left", socket.id);
      }
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  socket.on("signal", (data) => {
    try {
      const { to, signal } = data;

      if (!to || !signal) {
        socket.emit("error", "Invalid signal data");
        return;
      }

      socket.to(to).emit("signal", {
        from: socket.id,
        signal,
      });
    } catch (error) {
      console.error("Error handling signal:", error);
      socket.emit("error", "Failed to relay signal");
    }
  });

  socket.on("file-status", (data) => {
    try {
      const roomId = peerToRoom.get(socket.id);
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room || room.host !== socket.id) return;

      if (data.fileId) {
        room.fileId = data.fileId;
      }

      socket.to(roomId).emit("file-status", data);
    } catch (error) {
      console.error("Error handling file status:", error);
    }
  });

  socket.on("host-reconnect", (data) => {
    try {
      const { roomId, fileId } = data;

      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      socket.join(roomId);
      room.host = socket.id;
      room.peers.add(socket.id);
      peerToRoom.set(socket.id, roomId);

      if (fileId) {
        room.fileId = fileId;
      }

      socket.to(roomId).emit("host-rejoined", {
        fileId: room.fileId,
      });
    } catch (error) {
      console.error("Error handling host reconnect:", error);
    }
  });

  socket.on("disconnect", (reason) => {
    try {
      console.log(`Client disconnected: ${socket.id} (${reason})`);

      const roomId = peerToRoom.get(socket.id);
      if (roomId) {
        const room = removePeerFromRoom(socket.id);

        if (room) {
          const wasHost = room.host === socket.id;

          socket.to(roomId).emit("peer-left", socket.id);

          if (wasHost) {
            socket.to(roomId).emit("host-status", { isOnline: false });
          }
        }
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
});

// Health check endpoint
expressApp.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    connections: io.sockets.sockets.size,
    uptime: process.uptime(),
  });
});

// Room stats endpoint
expressApp.get("/stats", (req, res) => {
  const roomStats = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    peers: room.peers.size,
    host: room.host,
    hasFile: !!room.fileId,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
  }));

  res.json({
    totalRooms: rooms.size,
    totalConnections: io.sockets.sockets.size,
    rooms: roomStats,
  });
});

// Cleanup old rooms
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [roomId, room] of rooms.entries()) {
    if (room.peers.size === 0 && now - room.lastActivity > maxAge) {
      rooms.delete(roomId);
      console.log(`Cleaned up old room: ${roomId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Next.js request handling
expressApp.all("*", (req, res) => {
  return handle(req, res);
});

const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 P2P File Sharing App running on port ${PORT}`);
    console.log(`💡 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  });
});
