SHELL := /bin/bash
BINARY_NAME := omnihome
VERSION := 2.4.0
COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "dev")
LDFLAGS := -s -w -X main.Version=$(VERSION) -X main.GitCommit=$(COMMIT)

.PHONY: all build build-all build-linux-amd64 build-linux-arm64 build-darwin-arm64 build-windows-amd64 test run clean docker

all: build

build:
	@echo "==> Building native $(BINARY_NAME) binary..."
	go build -ldflags="$(LDFLAGS)" -o $(BINARY_NAME) main.go
	@echo "==> Native build complete: $(BINARY_NAME)"

build-all: build-linux-amd64 build-linux-arm64 build-darwin-arm64 build-windows-amd64
	@echo "==> All target binaries compiled into bin/"

build-linux-amd64:
	@mkdir -p bin
	@echo "==> Cross-compiling for Linux AMD64..."
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME)-linux-amd64 main.go

build-linux-arm64:
	@mkdir -p bin
	@echo "==> Cross-compiling for Linux ARM64 (Raspberry Pi 3/4/5)..."
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME)-linux-arm64 main.go

build-darwin-arm64:
	@mkdir -p bin
	@echo "==> Cross-compiling for macOS ARM64 (Apple Silicon)..."
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME)-darwin-arm64 main.go

build-windows-amd64:
	@mkdir -p bin
	@echo "==> Cross-compiling for Windows AMD64..."
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME)-windows-amd64.exe main.go

test:
	@echo "==> Running backend Go tests..."
	go test -v ./...

run: build
	@echo "==> Starting $(BINARY_NAME) on :8080..."
	./$(BINARY_NAME)

docker:
	@echo "==> Building Docker container..."
	docker build -t $(BINARY_NAME):latest -f Dockerfile .

clean:
	@echo "==> Cleaning build artifacts..."
	rm -rf bin/
	rm -f $(BINARY_NAME)
