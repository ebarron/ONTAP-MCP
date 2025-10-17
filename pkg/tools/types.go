package tools

import (
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// getApiClient returns an ONTAP client from either:
// 1. Cluster registry (if cluster_name provided), OR
// 2. Direct credentials (if cluster_ip, username, password provided), OR
// 3. Auto-select if only one cluster is registered (convenience fallback)
// This enables all tools to support both modes of operation.
func getApiClient(
	clusterManager *ontap.ClusterManager,
	args map[string]interface{},
) (*ontap.Client, error) {
	// Try registry mode first
	if clusterName, ok := args["cluster_name"].(string); ok && clusterName != "" {
		return clusterManager.GetClient(clusterName)
	}

	// Try direct credentials mode
	clusterIP, hasIP := args["cluster_ip"].(string)
	username, hasUser := args["username"].(string)
	password, hasPass := args["password"].(string)

	if hasIP && hasUser && hasPass && clusterIP != "" && username != "" && password != "" {
		cfg := &config.ClusterConfig{
			Name:      "temp",
			ClusterIP: clusterIP,
			Username:  username,
			Password:  password,
		}
		return ontap.NewClient(cfg, nil), nil
	}

	// Fallback: If only one cluster is registered, use it automatically
	// This is a convenience feature for single-cluster environments
	if clusterManager != nil {
		clusters := clusterManager.ListClusters()
		if len(clusters) == 1 {
			return clusterManager.GetClient(clusters[0])
		}
	}

	return nil, fmt.Errorf("must provide either 'cluster_name' (registry mode) OR 'cluster_ip'+'username'+'password' (direct mode)")
}

// Common tool result helpers
func successResult(message string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{{Type: "text", Text: message}},
	}
}

func errorResult(message string) *CallToolResult {
	return &CallToolResult{
		Content: []Content{{Type: "text", Text: fmt.Sprintf("❌ Error: %s", message)}},
		IsError: true,
	}
}

// Tool registration function type
type ToolRegisterFunc func(*Registry, *ontap.ClusterManager)

// RegisterAllTools registers all available MCP tools with the registry
func RegisterAllTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// Cluster Management Tools (4 tools)
	RegisterClusterTools(registry, clusterManager)

	// Volume Tools (18 tools)
	RegisterVolumeTools(registry, clusterManager)

	// CIFS Tools (8 tools)
	RegisterCIFSTools(registry, clusterManager)

	// Export Policy Tools (9 tools)
	RegisterExportPolicyTools(registry, clusterManager)

	// Snapshot Policy Tools (4 tools)
	RegisterSnapshotPolicyTools(registry, clusterManager)

	// QoS Policy Tools (5 tools)
	RegisterQoSPolicyTools(registry, clusterManager)

	// Volume Snapshot Tools (4 tools)
	RegisterVolumeSnapshotTools(registry, clusterManager)

	// Volume Autosize Tools (2 tools)
	RegisterVolumeAutosizeTools(registry, clusterManager)

	// Snapshot Schedule Tools (4 tools)
	RegisterSnapshotScheduleTools(registry, clusterManager)
}
