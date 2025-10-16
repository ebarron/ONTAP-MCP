package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// RegisterAllTools registers all 51 tools with the registry
// This will be fully implemented in Phase 3
func RegisterAllTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// Phase 1: Register a simple test tool to validate infrastructure
	registerTestTools(registry, clusterManager)

	// Phase 3: Register all 51 tools (to be implemented)
	// registerClusterManagementTools(registry, clusterManager)
	// registerVolumeTools(registry, clusterManager)
	// registerCifsTools(registry, clusterManager)
	// registerExportPolicyTools(registry, clusterManager)
	// registerSnapshotPolicyTools(registry, clusterManager)
	// registerQosTools(registry, clusterManager)
	// registerVolumeAutosizeTools(registry, clusterManager)
	// registerVolumeSnapshotTools(registry, clusterManager)
	// registerSnapshotScheduleTools(registry, clusterManager)
}

// registerTestTools registers simple test tools for Phase 1 validation
func registerTestTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// Test tool: list_registered_clusters
	registry.Register(
		"list_registered_clusters",
		"List all registered ONTAP clusters in the cluster manager",
		map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
			"required":   []string{},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusters := clusterManager.ListClusters()

			if len(clusters) == 0 {
				return &CallToolResult{
					Content: []Content{
						TextContent("No clusters registered"),
					},
				}, nil
			}

			text := fmt.Sprintf("Registered clusters (%d):\n", len(clusters))
			for _, name := range clusters {
				text += fmt.Sprintf("- %s\n", name)
			}

			return &CallToolResult{
				Content: []Content{
					TextContent(text),
				},
			}, nil
		},
	)

	// Test tool: get_all_clusters_info
	registry.Register(
		"get_all_clusters_info",
		"Get detailed information about all registered clusters",
		map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
			"required":   []string{},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusters := clusterManager.ListClusters()

			if len(clusters) == 0 {
				return &CallToolResult{
					Content: []Content{
						TextContent("No clusters registered"),
					},
				}, nil
			}

			text := ""
			for _, name := range clusters {
				client, err := clusterManager.GetClient(name)
				if err != nil {
					text += fmt.Sprintf("❌ %s: Failed to get client - %v\n\n", name, err)
					continue
				}

				info, err := client.GetClusterInfo(ctx)
				if err != nil {
					text += fmt.Sprintf("❌ %s: Connection failed - %v\n\n", name, err)
					continue
				}

				text += fmt.Sprintf("✅ %s: %s\n", name, info.ClusterIP)
				text += fmt.Sprintf("   ONTAP Version: %s\n", info.Version.Full)
				text += fmt.Sprintf("   UUID: %s\n", info.UUID)
				text += fmt.Sprintf("   State: %s\n\n", info.State)
			}

			return &CallToolResult{
				Content: []Content{
					TextContent(text),
				},
			}, nil
		},
	)
}
