# ERFlow React / Vite Frontend Dockerfile (Multi-stage build)

# Stage 1: Build static React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package lockfiles and install dependencies
COPY erflow_project/package*.json ./
RUN npm ci

# Copy frontend source code
COPY erflow_project/ ./

# Pass build environment variables to Vite
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_CHATBOT_API_URL=http://localhost:8001

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_CHATBOT_API_URL=$VITE_CHATBOT_API_URL

# Build production assets
RUN npm run build

# Stage 2: Serve static files with lightweight Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY erflow_project/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
