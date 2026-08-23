# Backend Dockerfile - Multi-stage build
# Stage 1: Build TypeScript code
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production runtime
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy built JavaScript from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Install production dependencies only
COPY package*.json ./
RUN npm install --only=production

# Expose port
EXPOSE 3000

# Start the server
CMD [ "node", "dist/server.js" ]