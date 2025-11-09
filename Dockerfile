# Multi-stage build for mimiuchi
# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Vue app (creates dist/ directory)
RUN npm run build:web

# Build the server and worker (TypeScript compilation)
RUN npx tsc server/index.ts --outDir dist-server --module nodenext --moduleResolution nodenext --esModuleInterop --target es2022 --lib es2022 --skipLibCheck

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-electron ./dist-electron
COPY --from=builder /app/dist-server ./dist-server

# Expose ports
# 3000: HTTP server for web interface
# 7714: WebSocket server for real-time translations
EXPOSE 3000 7714

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV WS_PORT=7714

# Run the server
CMD ["node", "dist-server/index.js"]
