# CI Configuration

Place Continuous Integration configuration files and scripts here.

## Examples

### GitHub Actions
Most GitHub Actions workflows are stored in `.github/workflows/`, but you can place additional CI scripts here.

### Other CI Systems
- Travis CI: `.travis.yml` (or scripts referenced by it)
- CircleCI: `config.yml` files
- Jenkins: Jenkinsfile or pipeline scripts
- GitLab CI: Additional scripts (main `.gitlab-ci.yml` stays in root)

## Structure

```
build/ci/
├── scripts/          # CI helper scripts
├── docker/           # CI-specific Docker configs
└── test-reports/     # CI test report templates (gitignored)
```
