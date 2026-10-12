# Multi-stage Dockerfile for OmniHome Core Gateway
# Stage 1: Build Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w -X main.Version=2.4.0" \
    -o /omnihome main.go

# Stage 2: Minimal runtime image
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata curl && \
    addgroup -S omnihome && adduser -S omnihome -G omnihome

COPY --from=builder /omnihome /app/omnihome

# Fix ownership
RUN chown -R omnihome:omnihome /app

USER omnihome

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/status || exit 1

ENTRYPOINT ["/app/omnihome"]
