# Frontend Dockerfile
FROM node:18-alpine AS build

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci

# Bundle app source
COPY . .

# Vite fige les variables VITE_* au moment du build : elles doivent arriver
# par --build-arg, pas par l'environnement du conteneur au runtime.
ARG VITE_APP_API_URL
ENV VITE_APP_API_URL=$VITE_APP_API_URL
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
