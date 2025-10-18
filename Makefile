# NetApp ONTAP MCP Server - Makefile
# Build automation for Docker images and deployments

# Configuration
DOCKER_REGISTRY ?= ghcr.io/ebarron
IMAGE_NAME ?= ontap-mcp
DEMO_IMAGE_NAME ?= ontap-mcp-demo
VERSION ?= 1.0.0
NODE_VERSION ?= 20-alpine
BINARY_NAME ?= ontap-mcp-server

# Computed values
IMAGE_TAG := $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
DEMO_IMAGE_TAG := $(DOCKER_REGISTRY)/$(DEMO_IMAGE_NAME):$(VERSION)
LATEST_TAG := $(DOCKER_REGISTRY)/$(IMAGE_NAME):latest
DEMO_LATEST_TAG := $(DOCKER_REGISTRY)/$(DEMO_IMAGE_NAME):latest

.PHONY: help
help: ## Show this help message
	@echo "NetApp ONTAP MCP Server - Make targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: build-go
build-go: ## Build Go binary to bin/ directory
	@echo "Building Go binary: bin/$(BINARY_NAME)"
	@mkdir -p bin
	go build -o bin/$(BINARY_NAME) ./cmd/ontap-mcp
	@echo "✅ Built: bin/$(BINARY_NAME) ($$(du -h bin/$(BINARY_NAME) | cut -f1))"

.PHONY: clean-go
clean-go: ## Remove Go build artifacts
	@echo "Cleaning Go build artifacts..."
	rm -f bin/$(BINARY_NAME)
	rm -f $(BINARY_NAME)
	@echo "✅ Cleaned"
build: ## Build the MCP server Docker image
	@echo "Building MCP server image: $(IMAGE_TAG)"
	docker build \
		--build-arg NODE_VERSION=$(NODE_VERSION) \
		-t $(IMAGE_NAME):$(VERSION) \
		-t $(IMAGE_NAME):latest \
		-f Dockerfile \
		.
	@echo "✅ Built: $(IMAGE_NAME):$(VERSION)"

.PHONY: build-demo
build-demo: ## Build the demo UI Docker image
	@echo "Building demo UI image: $(DEMO_IMAGE_TAG)"
	docker build \
		-t $(DEMO_IMAGE_NAME):$(VERSION) \
		-t $(DEMO_IMAGE_NAME):latest \
		-f demo/Dockerfile \
		demo/
	@echo "✅ Built: $(DEMO_IMAGE_NAME):$(VERSION)"

.PHONY: build-all
build-all: build build-demo ## Build both MCP server and demo UI images

.PHONY: run
run: build ## Build and run MCP server locally
	@echo "Starting MCP server on port 3000..."
	docker run --rm -it \
		-p 3000:3000 \
		--name ontap-mcp-server \
		$(IMAGE_NAME):latest

.PHONY: run-demo
run-demo: build-all ## Build and run full stack (MCP + Demo UI)
	@echo "Starting full stack with docker-compose..."
	docker-compose up -d
	@echo ""
	@echo "✅ Services started:"
	@echo "   MCP Server: http://localhost:3000"
	@echo "   Demo UI:    http://localhost:8080"
	@echo ""
	@echo "View logs:  docker-compose logs -f"
	@echo "Stop:       docker-compose down"

.PHONY: stop
stop: ## Stop all running containers
	@echo "Stopping all services..."
	docker-compose down
	@echo "✅ Services stopped"

.PHONY: logs
logs: ## View logs from all services
	docker-compose logs -f

.PHONY: logs-mcp
logs-mcp: ## View logs from MCP server only
	docker-compose logs -f ontap-mcp

.PHONY: logs-demo
logs-demo: ## View logs from demo UI only
	docker-compose logs -f demo-ui

.PHONY: test
test: build ## Build and test MCP server
	@echo "Running Docker image tests..."
	@echo "Starting container..."
	docker run -d --rm \
		-p 3000:3000 \
		--name ontap-mcp-test \
		$(IMAGE_NAME):latest
	@sleep 5
	@echo "Testing health endpoint..."
	@curl -f http://localhost:3000/health || (docker stop ontap-mcp-test && exit 1)
	@echo ""
	@echo "✅ Health check passed"
	@docker stop ontap-mcp-test
	@echo "✅ All tests passed"

.PHONY: clean
clean: ## Remove built images
	@echo "Removing Docker images..."
	-docker rmi $(IMAGE_NAME):$(VERSION) $(IMAGE_NAME):latest
	-docker rmi $(DEMO_IMAGE_NAME):$(VERSION) $(DEMO_IMAGE_NAME):latest
	@echo "✅ Images removed"

.PHONY: clean-all
clean-all: clean ## Remove images and volumes
	@echo "Removing Docker volumes..."
	-docker-compose down -v
	@echo "✅ Cleanup complete"

.PHONY: tag
tag: ## Tag images for registry push
	@echo "Tagging images for registry: $(DOCKER_REGISTRY)"
	docker tag $(IMAGE_NAME):$(VERSION) $(IMAGE_TAG)
	docker tag $(IMAGE_NAME):latest $(LATEST_TAG)
	docker tag $(DEMO_IMAGE_NAME):$(VERSION) $(DEMO_IMAGE_TAG)
	docker tag $(DEMO_IMAGE_NAME):latest $(DEMO_LATEST_TAG)
	@echo "✅ Images tagged for push"

.PHONY: push
push: tag ## Push images to registry (requires authentication)
	@echo "Pushing images to $(DOCKER_REGISTRY)..."
	docker push $(IMAGE_TAG)
	docker push $(LATEST_TAG)
	docker push $(DEMO_IMAGE_TAG)
	docker push $(DEMO_LATEST_TAG)
	@echo "✅ Images pushed to registry"

.PHONY: shell
shell: ## Open shell in running MCP container
	docker exec -it ontap-mcp-server sh

.PHONY: health
health: ## Check health of running services
	@echo "Checking service health..."
	@echo ""
	@echo "MCP Server:"
	@curl -s http://localhost:3000/health | jq . || echo "❌ MCP server not responding"
	@echo ""
	@echo "Demo UI:"
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8080 || echo "❌ Demo UI not responding"

.PHONY: npm-build
npm-build: ## Build TypeScript locally (without Docker)
	npm run build

.PHONY: npm-install
npm-install: ## Install npm dependencies locally
	npm install

.DEFAULT_GOAL := help
