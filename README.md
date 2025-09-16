# P2P File Sharing App

A modern, peer-to-peer file sharing application built with Next.js, WebRTC, and Socket.IO. Share files directly between devices without uploading to any server - your files never leave your local network!

![P2P File Sharing](https://img.shields.io/badge/P2P-File%20Sharing-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.2.0-black)
![WebRTC](https://img.shields.io/badge/WebRTC-Real%20Time-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)

## ✨ Features

- **🚀 Direct P2P Transfer**: Files are shared directly between devices using WebRTC
- **🌐 Local Network Support**: Works across your local network (WiFi/LAN)
- **📱 Multi-Device**: Share between phones, tablets, laptops, and desktops
- **📊 Real-time Progress**: Live transfer progress and speed monitoring
- **🎯 Room-based Sharing**: Create rooms and share files with multiple peers
- **💾 Chunked Transfer**: Large files are split into chunks for reliable transfer
- **🔒 Secure**: No files are stored on external servers
- **⚡ Fast**: Direct device-to-device communication for maximum speed

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Device A      │    │  Signaling      │    │   Device B      │
│   (Host)        │◄──►│  Server         │◄──►│   (Peer)        │
│                 │    │  (Socket.IO)    │    │                 │
│  Next.js App    │    │  Port 3001      │    │  Next.js App    │
│  Port 3000      │    │                 │    │  Port 3000      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    WebRTC Direct Connection
                    (Files transfer directly)
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Modern Browser** - Chrome, Firefox, Safari, or Edge
- **Local Network** - All devices must be on the same WiFi/LAN

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/souravrane/hikari-beam.git
   cd hikari-beam
   ```

2. **Start the application**

   ```bash
   chmod +x start.sh
   ./start.sh
   ```

3. **Open in browser**
   - Go to `http://localhost:3000`
   - Or use your local IP: `http://YOUR_IP:3000`

### Manual Setup

If you prefer to run the services separately:

1. **Install dependencies and start the signaling server**

   ```bash
   # Install backend dependencies
   npm install

   # Start signaling server
   npm start
   ```

2. **Start the frontend** (in a new terminal)
   ```bash
   cd p2p-share
   npm install
   npm run dev
   ```

## 📖 How to Use

### For the Host (File Sender)

1. **Open the app** in your browser
2. **Click "Create New Room"** to generate a room ID
3. **Select a file** to share using the file picker
4. **Share the room URL** with other devices
5. **Wait for peers** to join and start the transfer

### For Peers (File Receivers)

1. **Open the room URL** in your browser
2. **Wait for the host** to select a file
3. **Accept the file** when prompted
4. **Watch the download** progress in real-time

## 🌐 Network Access

### Local Network Sharing

To share files across devices on your local network:

1. **Find your local IP address**:

   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v "127.0.0.1"

   # Windows
   ipconfig | findstr "IPv4"
   ```

2. **Access from other devices**:
   - Use `http://YOUR_IP:3000` instead of `http://localhost:3000`
   - All devices must be on the same WiFi network

### Troubleshooting Network Issues

- **Check firewall settings** - Ensure ports 3000 and 3001 are not blocked
- **Verify network connectivity** - All devices must be on the same network
- **Try refreshing** the page if connections fail
- **Check browser console** for any error messages

## 🛠️ Development

### Project Structure

```
hikari-beam/
├── package.json               # Root package.json (backend config)
├── signaling-server/          # Socket.IO signaling server
│   ├── server.js             # Express + Socket.IO server
│   └── package.json          # Backend dependencies
├── p2p-share/                 # Next.js frontend application
│   ├── app/                   # Next.js app directory
│   │   ├── components/        # React components
│   │   └── r/[roomId]/        # Dynamic room pages
│   ├── lib/                   # Core P2P logic
│   │   ├── webrtc.ts         # WebRTC connection management
│   │   ├── signaling.ts      # Socket.IO signaling
│   │   ├── file-transfer.ts  # File transfer logic
│   │   └── chunking.ts       # File chunking utilities
│   └── package.json          # Frontend dependencies
└── start.sh                  # Development startup script
```

### Available Scripts

**Backend (Root Directory)**

```bash
npm install          # Install backend dependencies
npm start            # Start signaling server (production)
npm run dev          # Start signaling server (development)
npm run build        # Build frontend for production
```

**Frontend (p2p-share)**

```bash
cd p2p-share
npm install          # Install frontend dependencies
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Environment Variables

Create `.env.local` in the `p2p-share` directory:

```bash
# Optional: Custom signaling server URL
NEXT_PUBLIC_SIGNALING_SERVER=ws://localhost:3001
```

## 🔧 Configuration

### Signaling Server

The signaling server runs on port 3001 by default. You can configure it by setting environment variables:

```bash
HOST=0.0.0.0          # Bind to all interfaces
PORT=3001             # Server port
```

### CORS Configuration

The server is configured to accept connections from:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- Any local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

## 📊 API Endpoints

### Signaling Server

- `GET /health` - Health check endpoint
- `GET /stats` - Server statistics and room information

### WebSocket Events

**Client to Server:**

- `join` - Join a room
- `leave` - Leave a room
- `signal` - Send WebRTC signaling data
- `file-status` - Update file sharing status

**Server to Client:**

- `joined` - Confirmation of room join
- `peer-joined` - New peer joined the room
- `peer-left` - Peer left the room
- `signal` - WebRTC signaling data from another peer

## 🧪 Testing

The project includes comprehensive testing documentation. See `TESTING.md` for detailed testing procedures and test cases.

## 🚀 Deployment

### Production Build

1. **Build the frontend**:

   ```bash
   cd p2p-share
   npm run build
   ```

2. **Start production servers**:

   ```bash
   # Start signaling server
   cd signaling-server
   npm start

   # Start frontend (in another terminal)
   cd p2p-share
   npm start
   ```

### Docker Deployment

```dockerfile
# Example Dockerfile for signaling server
FROM node:18-alpine
WORKDIR /app
COPY signaling-server/package*.json ./
RUN npm ci --only=production
COPY signaling-server/ .
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC** for peer-to-peer communication
- **Socket.IO** for signaling server
- **Next.js** for the React framework
- **Tailwind CSS** for styling
- **TypeScript** for type safety

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/souravrane/hikari-beam/issues) page
2. Review the `TESTING.md` file for troubleshooting
3. Create a new issue with detailed information

## 🔮 Future Enhancements

See `FUTURE_ENHANCEMENTS.md` for planned features and improvements.

---

**Happy File Sharing! 🎉**

_Built with ❤️ using modern web technologies_
