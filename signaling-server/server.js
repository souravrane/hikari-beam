const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = createServer(app);

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      /\.railway\.app$/, // Allow Railway domains
      /\.vercel\.app$/, // Allow Vercel domains
      /\.netlify\.app$/, // Allow Netlify domains
      /\.herokuapp\.com$/, // Allow Heroku domains
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Serve static files from Next.js build
const nextBuildPath = path.join(__dirname, "../p2p-share/.next/static");
const nextPublicPath = path.join(__dirname, "../p2p-share/public");

app.use("/_next/static", express.static(nextBuildPath));
app.use(express.static(nextPublicPath));

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      /\.railway\.app$/, // Allow Railway domains
      /\.vercel\.app$/, // Allow Vercel domains
      /\.netlify\.app$/, // Allow Netlify domains
      /\.herokuapp\.com$/, // Allow Heroku domains
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Room and peer management
const rooms = new Map();
const peerToRoom = new Map();

// Room management helper functions
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

  // Only assign host if room is empty OR if explicitly requested to be host
  if (room.peers.size === 0) {
    room.host = socketId;
    console.log(`🎯 ${socketId} becomes HOST of room ${roomId} (first peer)`);
  } else if (isHost && room.host !== socketId) {
    // Allow explicit host takeover only if current host is not in room
    const currentHostInRoom = room.peers.has(room.host);
    if (!currentHostInRoom) {
      room.host = socketId;
      console.log(`🎯 ${socketId} becomes HOST of room ${roomId} (takeover)`);
    } else {
      console.log(
        `⚠️ ${socketId} tried to become host but ${room.host} is still active`
      );
    }
  }

  room.peers.add(socketId);
  room.lastActivity = Date.now();
  peerToRoom.set(socketId, roomId);

  console.log(
    `📊 Room ${roomId}: host=${room.host}, peers=${Array.from(room.peers).join(
      ", "
    )}`
  );

  return room;
}

function removePeerFromRoom(socketId) {
  const roomId = peerToRoom.get(socketId);
  if (!roomId) return null;

  const room = rooms.get(roomId);
  if (!room) return null;

  room.peers.delete(socketId);
  peerToRoom.delete(socketId);

  // If host left, assign new host
  if (room.host === socketId && room.peers.size > 0) {
    room.host = room.peers.values().next().value;
  }

  // Clean up empty rooms
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
    joinedAt: Date.now(), // In production, track actual join time
  }));
}

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join room
  socket.on("join", (roomId, options = {}) => {
    try {
      console.log(`${socket.id} joining room: ${roomId}`, options);

      // Validate room ID
      if (!roomId || typeof roomId !== "string" || roomId.length !== 8) {
        socket.emit("error", "Invalid room ID");
        return;
      }

      // Leave current room if in one
      const currentRoomId = peerToRoom.get(socket.id);
      if (currentRoomId) {
        socket.leave(currentRoomId);
        removePeerFromRoom(socket.id);
      }

      // Join new room
      socket.join(roomId);
      const room = addPeerToRoom(
        roomId,
        socket.id,
        options.preferHost || false
      );
      const peers = getRoomPeers(roomId);
      const isHost = room.host === socket.id;

      // Notify the joining peer
      socket.emit("joined", {
        roomId,
        peers: peers.filter((p) => p.id !== socket.id), // Exclude self
        isHost,
      });

      // Notify other peers in the room
      socket.to(roomId).emit("peer-joined", {
        id: socket.id,
        isHost,
        joinedAt: Date.now(),
      });

      console.log(
        `${socket.id} joined room ${roomId} as ${isHost ? "host" : "peer"}`
      );
      console.log(`Room ${roomId} now has ${room.peers.size} peers`);
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", "Failed to join room");
    }
  });

  // Leave room
  socket.on("leave", (roomId) => {
    try {
      console.log(`${socket.id} leaving room: ${roomId}`);

      socket.leave(roomId);
      const room = removePeerFromRoom(socket.id);

      if (room) {
        // Notify other peers
        socket.to(roomId).emit("peer-left", socket.id);
        console.log(`${socket.id} left room ${roomId}`);
      }
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  });

  // Handle signaling messages
  socket.on("signal", (data) => {
    try {
      const { to, signal } = data;

      if (!to || !signal) {
        socket.emit("error", "Invalid signal data");
        return;
      }

      console.log(`Relaying ${signal.type} from ${socket.id} to ${to}`);

      // Relay signaling message to target peer
      socket.to(to).emit("signal", {
        from: socket.id,
        signal,
      });
    } catch (error) {
      console.error("Error handling signal:", error);
      socket.emit("error", "Failed to relay signal");
    }
  });

  // Handle file sharing status
  socket.on("file-status", (data) => {
    try {
      const roomId = peerToRoom.get(socket.id);
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room || room.host !== socket.id) return;

      // Update room file status
      if (data.fileId) {
        room.fileId = data.fileId;
      }

      // Broadcast file status to all peers in room
      socket.to(roomId).emit("file-status", data);
    } catch (error) {
      console.error("Error handling file status:", error);
    }
  });

  // Handle host reconnection
  socket.on("host-reconnect", (data) => {
    try {
      const { roomId, fileId } = data;

      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      // Rejoin as host
      socket.join(roomId);
      room.host = socket.id;
      room.peers.add(socket.id);
      peerToRoom.set(socket.id, roomId);

      if (fileId) {
        room.fileId = fileId;
      }

      // Notify all peers that host has rejoined
      socket.to(roomId).emit("host-rejoined", {
        fileId: room.fileId,
      });

      console.log(
        `Host ${socket.id} rejoined room ${roomId} with file ${fileId}`
      );
    } catch (error) {
      console.error("Error handling host reconnect:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    try {
      console.log(`Client disconnected: ${socket.id} (${reason})`);

      const roomId = peerToRoom.get(socket.id);
      if (roomId) {
        const room = removePeerFromRoom(socket.id);

        if (room) {
          const wasHost = room.host === socket.id;

          // Notify remaining peers
          socket.to(roomId).emit("peer-left", socket.id);

          if (wasHost) {
            // Notify peers that host went offline
            socket.to(roomId).emit("host-status", { isOnline: false });
          }

          console.log(`Peer ${socket.id} removed from room ${roomId}`);
        }
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
});

// Serve Next.js pages
const fs = require("fs");

// Check if Next.js build exists
const nextBuildExists = fs.existsSync(path.join(__dirname, "../p2p-share/.next"));

if (nextBuildExists) {
  // Serve Next.js static pages
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../p2p-share/.next/server/app/page.html"));
  });

  app.get("/r/:roomId", (req, res) => {
    res.sendFile(path.join(__dirname, "../p2p-share/.next/server/app/r/[roomId]/page.html"));
  });

  // Catch-all route for Next.js pages
  app.get("*", (req, res) => {
    // Try to serve the specific page first, fallback to index
    const pagePath = path.join(__dirname, `../p2p-share/.next/server/app${req.path}.html`);
    if (fs.existsSync(pagePath)) {
      res.sendFile(pagePath);
    } else {
      res.sendFile(path.join(__dirname, "../p2p-share/.next/server/app/page.html"));
    }
  });
} else {
  // Development fallback - redirect to frontend dev server
  app.get("*", (req, res) => {
    if (req.path.startsWith("/health") || req.path.startsWith("/stats")) {
      return; // Let API routes handle themselves
    }
    res.send(`
      <html>
        <body>
          <h1>P2P File Share</h1>
          <p>Frontend not built yet. Please run:</p>
          <pre>cd p2p-share && npm run build</pre>
          <p>Or visit the dev server at <a href="http://localhost:3000">http://localhost:3000</a></p>
        </body>
      </html>
    `);
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: rooms.size,
    connections: io.sockets.sockets.size,
    uptime: process.uptime(),
    frontendBuilt: nextBuildExists,
  });
});

// Room stats endpoint
app.get("/stats", (req, res) => {
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

// Cleanup old empty rooms periodically
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 P2P Signaling Server running on port ${PORT}`);
  console.log(`💡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
});
