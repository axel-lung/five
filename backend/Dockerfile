# Backend Dockerfile - Multi-stage build
# Stage 1: Build TypeScript code
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install app dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production dependencies only
FROM node:18-alpine AS deps

WORKDIR /usr/src/app

# Aucune dependance native depuis le retrait de sqlite3 : pas de toolchain.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 3: Production runtime
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy production node_modules and built JavaScript
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY package*.json ./

# Run as an unprivileged user (the node image ships a `node` user)
USER node

# Expose port (doit correspondre a PORT dans docker-compose.yml)
EXPOSE 6010

# Start the server
CMD [ "node", "dist/server.js" ]
