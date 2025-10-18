# Build Configuration

This directory contains build and packaging configuration files following the [Go project layout standard](https://github.com/golang-standards/project-layout).

## Directory Structure

### `/build/ci`
Continuous Integration (CI) configuration files and scripts.

**Examples:**
- Travis CI configs
- CircleCI configs
- GitHub Actions workflows (note: actual workflows live in `.github/workflows/`)
- Jenkins pipelines
- Custom CI scripts

### `/build/package`
Packaging configurations for various platforms and package managers.

**Examples:**
- Docker build configurations
- Debian/RPM package specs
- Homebrew formulae
- Cloud deployment configs (AMI, etc.)
- Container image build scripts

## Note on Build Artifacts

The `/build` directory itself is gitignored for build artifacts (compiled TypeScript, temporary files).
Only the `/build/ci` and `/build/package` subdirectories are tracked in version control.

## Current Build Process

### Go Binary
```bash
# Build Go binary (outputs to project root or bin/)
go build -o ontap-mcp-server ./cmd/ontap-mcp

# Recommended: output to bin/ directory
go build -o bin/ontap-mcp-server ./cmd/ontap-mcp
```

### TypeScript (Legacy)
```bash
# TypeScript compilation (outputs to build/)
npm run build
```

## Docker Packaging

Docker configurations are currently in:
- `/Dockerfile` - Main Dockerfile
- `/docker-compose.yml` - Docker Compose configuration
- `/deployments/` - Deployment manifests

These could be consolidated into `/build/package/` for better organization.
