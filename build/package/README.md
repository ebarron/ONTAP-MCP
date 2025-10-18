# Package Configuration

Place packaging and distribution configuration files here.

## Examples

### Container Images
- Dockerfile variants (multi-stage, alpine, etc.)
- Docker Compose files for packaging
- Container registry configs

### OS Packages
- Debian/Ubuntu: `.deb` package specs
- Red Hat/CentOS: `.rpm` package specs
- macOS: Homebrew formula

### Cloud Images
- AWS AMI build configs
- Google Cloud VM images
- Azure VM images

### Deployment Packages
- Kubernetes Helm charts (or link to `/deployments`)
- Terraform modules for packaging infrastructure
- Ansible packaging playbooks

## Current Packaging

Main packaging configs currently live in:
- `/Dockerfile` - Main container image
- `/docker-compose.yml` - Compose configuration  
- `/deployments/` - Kubernetes/deployment manifests

These could be moved here for consolidation.

## Structure

```
build/package/
├── docker/           # Docker-related packaging
├── deb/              # Debian package specs
├── rpm/              # RPM package specs
└── cloud/            # Cloud image configs
```
