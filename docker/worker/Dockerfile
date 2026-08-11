# =============================================================================
# Multi-stage build for Go Worker
# Stage 1: Build binary
# Stage 2: Minimal runtime image
# =============================================================================

# Stage 1 — Build
FROM golang:1.23-alpine AS builder

WORKDIR /build

# Install dependencies for go-ping (needs gcc for raw socket support)
RUN apk add --no-cache gcc musl-dev

# Copy go.mod first for layer caching
COPY go.mod ./
RUN go mod download

# Copy source and build
COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" \
    -o /build/nms-worker \
    ./cmd/nms-worker

# =============================================================================
# Stage 2 — Runtime
# =============================================================================
FROM alpine:3.20

WORKDIR /app

# Install ca-certificates for HTTPS calls (future use) and iputils for diagnostics
RUN apk add --no-cache ca-certificates iputils

# Copy compiled binary from builder stage
COPY --from=builder /build/nms-worker .

# Copy .env.example as default — override with volume mount or env vars in docker-compose
COPY .env.example .env

# The worker runs as a daemon, no port exposed
CMD ["./nms-worker"]
