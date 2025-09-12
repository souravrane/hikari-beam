# Multi-stage build for P2P File Sharing App
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY signaling-server/package*.json ./signaling-server/
COPY p2p-share/package*.json ./p2p-share/

# Install dependencies
RUN cd signaling-server && npm ci --only=production
RUN cd p2p-share && npm ci --only=production

# Build the frontend
FROM base AS builder
WORKDIR /app
COPY p2p-share/package*.json ./
RUN npm ci
COPY p2p-share/ ./
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Copy signaling server
COPY --from=deps /app/signaling-server ./signaling-server
COPY signaling-server/ ./signaling-server/

# Copy built frontend
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Install production dependencies for frontend
RUN npm ci --only=production

# Create a simple server to serve both frontend and signaling
COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
