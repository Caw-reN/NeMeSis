# =============================================================================
# Multi-stage build for React Frontend
# Stage 1: Build with Node
# Stage 2: Serve with Nginx
# =============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (for layer caching)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .

# Set production API URL (override in docker-compose if needed)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# =============================================================================
# Stage 2 — Nginx serving production build
# =============================================================================
FROM nginx:stable-alpine

# Copy build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config: handle React Router (redirect all to index.html)
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
