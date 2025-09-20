# Test Environment Configuration

This document explains how to securely configure and run tests for the NetApp ONTAP MCP Server without hardcoding credentials in the repository.

## Security Model

All test scripts now use environment variables to configure ONTAP clusters, ensuring that:
- ✅ No credentials are stored in source code
- ✅ No credentials are committed to git
- ✅ Users control their own cluster configurations
- ✅ Same configuration works for both development and testing

## Quick Setup

### Option 1: Interactive Setup (Recommended)

Use the interactive script to set up your test environment:

```bash
./test/setup-test-env.sh
```

This will guide you through configuring your clusters and optionally set the environment variables for your current session.

### Option 2: Manual Configuration

Set the environment variables manually:

```bash
# Configure your clusters
export ONTAP_CLUSTERS='[
  {
    "name": "my-cluster",
    "cluster_ip": "10.x.x.x",
    "username": "admin",
    "password": "your-password",
    "description": "My test cluster"
  }
]'

# Optional: Customize test parameters
export TEST_SVM_NAME="vs0"              # Default SVM for testing
export TEST_AGGREGATE_NAME="aggr1_1"    # Default aggregate for testing
```

## Available Test Scripts

### Volume Lifecycle Testing

Test the complete create → offline → delete workflow:

```bash
# Build the project first
npm run build

## Running Tests

Once configured, you can run tests in different modes:

```bash
# Test STDIO mode
node test/test-volume-lifecycle.js stdio

# Test REST API mode  
node test/test-volume-lifecycle.js rest

# Test REST API via bash script
./test/test-volume-lifecycle.sh

## Additional Test Tools

```bash
# Check aggregates across all clusters
node test/check-aggregates.js
```

### Aggregate Checking

Check aggregates across all configured clusters:

```bash
node check-aggregates.js
```

## Environment Variables

### Required

- `ONTAP_CLUSTERS`: JSON array of cluster configurations

### Optional

- `TEST_SVM_NAME`: SVM name to use for testing (default: "vs0")
- `TEST_AGGREGATE_NAME`: Aggregate name to use for testing (default: "aggr1_1")

## Example Configurations

### Single Cluster

```bash
export ONTAP_CLUSTERS='[
  {
    "name": "production",
    "cluster_ip": "ontap.example.com",
    "username": "admin",
    "password": "secure-password",
    "description": "Production ONTAP cluster"
  }
]'
```

### Multiple Clusters

```bash
export ONTAP_CLUSTERS='[
  {
    "name": "production",
    "cluster_ip": "ontap-prod.example.com",
    "username": "admin",
    "password": "prod-password",
    "description": "Production cluster"
  },
  {
    "name": "development",
    "cluster_ip": "ontap-dev.example.com",
    "username": "admin",
    "password": "dev-password",
    "description": "Development cluster"
  }
]'
```

## Security Best Practices

### For Development

1. **Never commit credentials**: Use environment variables or local config files (added to .gitignore)
2. **Use dedicated test accounts**: Create specific ONTAP users for testing with minimal required privileges
3. **Rotate credentials regularly**: Change test passwords periodically
4. **Use non-production clusters**: Test against development or staging environments when possible

### For CI/CD

1. **Use secrets management**: Store credentials in your CI/CD platform's secret store
2. **Limit access**: Restrict who can view/modify the secrets
3. **Use service accounts**: Create dedicated service accounts for automated testing
4. **Monitor usage**: Log and monitor test cluster access

### Environment Variable Storage

#### Option 1: Shell Profile (Local Development)

Add to your `~/.bashrc`, `~/.zshrc`, or equivalent:

```bash
# NetApp ONTAP MCP Test Configuration
export ONTAP_CLUSTERS='[{"name":"test","cluster_ip":"10.x.x.x","username":"admin","password":"password"}]'
export TEST_SVM_NAME="vs0"
export TEST_AGGREGATE_NAME="aggr1_1"
```

#### Option 2: Environment File (Project-Specific)

Create a `.env.local` file (add to .gitignore):

```bash
ONTAP_CLUSTERS=[{"name":"test","cluster_ip":"10.x.x.x","username":"admin","password":"password"}]
TEST_SVM_NAME=vs0
TEST_AGGREGATE_NAME=aggr1_1
```

Load with: `source .env.local`

#### Option 3: Temporary Session

Set for current session only:

```bash
# Set variables
export ONTAP_CLUSTERS='...'

# Run tests
```bash
npm run build && node test/test-volume-lifecycle.js
```

# Variables are cleared when terminal session ends
```

## Troubleshooting

### Environment Not Set

If you see "ONTAP_CLUSTERS environment variable not set":

1. Run `./test/setup-test-env.sh` to configure
2. Or manually set the `ONTAP_CLUSTERS` environment variable
3. Verify with: `echo $ONTAP_CLUSTERS`

### Invalid JSON Configuration

If you see "Failed to parse ONTAP_CLUSTERS":

1. Validate your JSON using `echo $ONTAP_CLUSTERS | jq .`
2. Check for proper escaping of quotes and special characters
3. Use the setup script to generate valid configuration

### Connection Issues

If tests fail to connect to ONTAP:

1. Verify cluster IP/hostname is accessible
2. Check username/password credentials
3. Ensure ONTAP REST API is enabled
4. Verify network connectivity and firewall rules

### Permission Issues

If you see authentication or permission errors:

1. Verify the user has required ONTAP privileges
2. Check if the account is locked or expired
3. Test credentials using ONTAP CLI or GUI
4. Ensure the user has access to the required SVMs and aggregates

## Migration from Old Scripts

If you have old test scripts with hardcoded credentials:

1. ✅ Remove hardcoded cluster information
2. ✅ Update scripts to read from `ONTAP_CLUSTERS` environment variable
3. ✅ Add error handling for missing environment variables
4. ✅ Test with the new environment-based configuration
5. ✅ Document the new setup process

This ensures your credentials stay secure while maintaining full testing functionality.
