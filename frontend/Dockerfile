# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY packages/ ./packages/

# Copy scripts directory first (needed for postinstall scripts)
COPY scripts/ ./scripts/

# Install dependencies with legacy peer deps to avoid conflicts
RUN npm ci --only=production --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose HTTPS (3001) ports
EXPOSE 3001

# Start nginx
CMD ["nginx", "-g", "daemon off;"]