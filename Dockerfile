FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY p2p-share/package*.json ./p2p-share/
COPY signaling-server/package*.json ./signaling-server/

# Install all dependencies
RUN npm install
RUN cd p2p-share && npm install
RUN cd signaling-server && npm install

# Copy source code
COPY . .

# Build the frontend
RUN cd p2p-share && npm run build

EXPOSE 3000

CMD ["node", "server.js"]
