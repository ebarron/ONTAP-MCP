package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// getApiClient returns an ONTAP client from either:
// 1. Cluster registry (if cluster_name provided), OR
// 2. Direct credentials (if cluster_ip, username, password provided)
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

	return nil, fmt.Errorf("must provide either 'cluster_name' (registry mode) OR 'cluster_ip'+'username'+'password' (direct mode)")
}

// RegisterAllTools registers all available MCP tools with the registry
func RegisterAllTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// Cluster Management Tools (4 tools)
	registerClusterTools(registry, clusterManager)

	// Volume Tools (18 tools)
	registerVolumeTools(registry, clusterManager)

	// CIFS Tools (8 tools)
	registerCIFSTools(registry, clusterManager)

	// Export Policy Tools (9 tools)
	registerExportPolicyTools(registry, clusterManager)

	// Snapshot Policy Tools (4 tools)
	registerSnapshotPolicyTools(registry, clusterManager)

	// QoS Policy Tools (5 tools)
	registerQoSPolicyTools(registry, clusterManager)

	// Volume Snapshot Tools (4 tools)
	registerVolumeSnapshotTools(registry, clusterManager)

	// Volume Autosize Tools (2 tools)
	registerVolumeAutosizeTools(registry, clusterManager)

	// Snapshot Schedule Tools (4 tools)
	registerSnapshotScheduleTools(registry, clusterManager)
}

// registerClusterTools registers cluster management tools (4 tools)
func registerClusterTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_registered_clusters - List all registered clusters
	registry.Register(
		"list_registered_clusters",
		"List all registered ONTAP clusters in the cluster manager",
		map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusters := clusterManager.ListClusters()
			var result string
			if len(clusters) == 0 {
				result = "No clusters registered"
			} else {
				result = fmt.Sprintf("Registered clusters (%d):\n", len(clusters))
				for _, name := range clusters {
					result += fmt.Sprintf("- %s\n", name)
				}
			}
			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. get_all_clusters_info - Get detailed information about all clusters
	registry.Register(
		"get_all_clusters_info",
		"Get cluster information for all registered clusters",
		map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusters := clusterManager.ListClusters()
			if len(clusters) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No clusters registered"}},
				}, nil
			}

			var result string
			for _, name := range clusters {
				client, err := clusterManager.GetClient(name)
				if err != nil {
					result += fmt.Sprintf("- %s: Error: %v\n", name, err)
					continue
				}

				info, err := client.GetClusterInfo(ctx)
				if err != nil {
					result += fmt.Sprintf("- %s: Error: %v\n", name, err)
					continue
				}

				result += fmt.Sprintf("- %s: %s (ONTAP %s)\n", name, info.Name, info.Version.Full)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. add_cluster - Add a cluster to the registry (runtime registration)
	registry.Register(
		"add_cluster",
		"Add a new ONTAP cluster to the registry for multi-cluster management",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"name", "cluster_ip", "username", "password"},
			"properties": map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Unique name for the cluster",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication",
				},
				"description": map[string]interface{}{
					"type":        "string",
					"description": "Optional description of the cluster",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			name := args["name"].(string)
			clusterIP := args["cluster_ip"].(string)
			username := args["username"].(string)
			password := args["password"].(string)
			description := ""
			if desc, ok := args["description"].(string); ok {
				description = desc
			}

			cfg := &config.ClusterConfig{
				Name:        name,
				ClusterIP:   clusterIP,
				Username:    username,
				Password:    password,
				Description: description,
			}

			err := clusterManager.AddCluster(cfg)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to add cluster: %v", err))},
					IsError: true,
				}, nil
			}

			// Test connection
			client, err := clusterManager.GetClient(name)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Cluster added but connection failed: %v", err))},
					IsError: true,
				}, nil
			}

			info, err := client.GetClusterInfo(ctx)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Cluster added but unable to get info: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully added cluster '%s'\n", name)
			result += fmt.Sprintf("Cluster: %s (ONTAP %s)\n", info.Name, info.Version.Full)
			result += fmt.Sprintf("UUID: %s", info.UUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 4. cluster_list_svms - List SVMs on a registered cluster
	registry.Register(
		"cluster_list_svms",
		"List Storage Virtual Machines (SVMs) on a registered cluster",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			svms, err := client.ListSVMs(ctx)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list SVMs: %v", err))},
					IsError: true,
				}, nil
			}

			if len(svms) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No SVMs found"}},
				}, nil
			}

			result := fmt.Sprintf("SVMs on cluster '%s' (%d):\n", clusterName, len(svms))
			for _, svm := range svms {
				result += fmt.Sprintf("- %s (%s) - State: %s", svm.Name, svm.UUID, svm.State)
				if svm.Subtype != "" {
					result += fmt.Sprintf(", Type: %s", svm.Subtype)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}

// Placeholder registration functions for other tool categories
// These will be implemented progressively

func registerVolumeTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_list_volumes - List volumes on a cluster
	registry.Register(
		"cluster_list_volumes",
		"List volumes on a registered cluster by cluster name",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Optional: Filter volumes by SVM name",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			volumes, err := client.ListVolumes(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list volumes: %v", err))},
					IsError: true,
				}, nil
			}

			if len(volumes) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No volumes found"}},
				}, nil
			}

			result := fmt.Sprintf("Volumes on cluster '%s' (%d):\n", clusterName, len(volumes))
			for _, vol := range volumes {
				result += fmt.Sprintf("- %s (%s) - State: %s", vol.Name, vol.UUID, vol.State)
				if vol.SVM != nil {
					result += fmt.Sprintf(", SVM: %s", vol.SVM.Name)
				}
				if vol.Space != nil {
					sizeTB := float64(vol.Space.Size) / (1024 * 1024 * 1024 * 1024)
					result += fmt.Sprintf(", Size: %.2fTB", sizeTB)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. cluster_list_aggregates - List aggregates on a cluster
	registry.Register(
		"cluster_list_aggregates",
		"List aggregates from a registered cluster. Optionally filter to show only aggregates assigned to a specific SVM",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Optional: Filter to show only aggregates assigned to this SVM",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			aggregates, err := client.ListAggregates(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list aggregates: %v", err))},
					IsError: true,
				}, nil
			}

			if len(aggregates) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No aggregates found"}},
				}, nil
			}

			result := fmt.Sprintf("Aggregates on cluster '%s' (%d):\n", clusterName, len(aggregates))
			for _, aggr := range aggregates {
				result += fmt.Sprintf("- %s (%s) - State: %s", aggr.Name, aggr.UUID, aggr.State)
				if aggr.Space != nil && aggr.Space.BlockStorage != nil {
					sizeTB := float64(aggr.Space.BlockStorage.Size) / (1024 * 1024 * 1024 * 1024)
					availTB := float64(aggr.Space.BlockStorage.Available) / (1024 * 1024 * 1024 * 1024)
					result += fmt.Sprintf(", Size: %.2fTB, Available: %.2fTB", sizeTB, availTB)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. cluster_create_volume - Create a volume on a cluster
	registry.Register(
		"cluster_create_volume",
		"Create a volume on a registered cluster by cluster name",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "svm_name", "volume_name", "size"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the SVM where the volume will be created",
				},
				"volume_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the new volume",
				},
				"size": map[string]interface{}{
					"type":        "string",
					"description": "Size of the volume (e.g., '100GB', '1TB')",
				},
				"aggregate_name": map[string]interface{}{
					"type":        "string",
					"description": "Optional: Name of the aggregate to use",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := args["svm_name"].(string)
			volumeName := args["volume_name"].(string)
			sizeStr := args["size"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			// Parse size string (simple parser for GB/TB)
			var sizeBytes int64
			if len(sizeStr) > 2 {
				unit := sizeStr[len(sizeStr)-2:]
				numStr := sizeStr[:len(sizeStr)-2]
				var num float64
				fmt.Sscanf(numStr, "%f", &num)
				if unit == "GB" {
					sizeBytes = int64(num * 1024 * 1024 * 1024)
				} else if unit == "TB" {
					sizeBytes = int64(num * 1024 * 1024 * 1024 * 1024)
				}
			}

			req := &ontap.CreateVolumeRequest{
				Name: volumeName,
				SVM:  map[string]string{"name": svmName},
				Size: sizeBytes,
			}

			if aggrName, ok := args["aggregate_name"].(string); ok && aggrName != "" {
				req.Aggregates = []map[string]string{{"name": aggrName}}
			}

			response, err := client.CreateVolume(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully created volume '%s' on SVM '%s'\n", volumeName, svmName)
			if response.UUID != "" {
				result += fmt.Sprintf("Volume UUID: %s", response.UUID)
			} else if response.Job != nil {
				result += fmt.Sprintf("Job UUID: %s (creation in progress)", response.Job.UUID)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 4. cluster_update_volume - Update volume properties
	registry.Register(
		"cluster_update_volume",
		"Update multiple volume properties on a registered cluster including size, comment, security style, state, QoS policy, snapshot policy, and NFS export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume to update",
				},
				"size": map[string]interface{}{
					"type":        "string",
					"description": "New size (e.g., '500GB', '2TB') - can only increase",
				},
				"comment": map[string]interface{}{
					"type":        "string",
					"description": "New comment/description",
				},
				"state": map[string]interface{}{
					"type":        "string",
					"description": "Volume state: 'online' for normal access, 'offline' to make inaccessible (required before deletion), 'restricted' for admin-only access",
					"enum":        []string{"online", "offline", "restricted"},
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			updates := make(map[string]interface{})

			// Parse size if provided
			if sizeStr, ok := args["size"].(string); ok {
				var sizeBytes int64
				if len(sizeStr) > 2 {
					unit := sizeStr[len(sizeStr)-2:]
					numStr := sizeStr[:len(sizeStr)-2]
					var num float64
					fmt.Sscanf(numStr, "%f", &num)
					if unit == "GB" {
						sizeBytes = int64(num * 1024 * 1024 * 1024)
					} else if unit == "TB" {
						sizeBytes = int64(num * 1024 * 1024 * 1024 * 1024)
					}
				}
				updates["space"] = map[string]interface{}{"size": sizeBytes}
			}

			if comment, ok := args["comment"].(string); ok {
				updates["comment"] = comment
			}

			if state, ok := args["state"].(string); ok {
				updates["state"] = state
			}

			if len(updates) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No updates specified"}},
				}, nil
			}

			err = client.UpdateVolume(ctx, volumeUUID, updates)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to update volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully updated volume %s", volumeUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 5. cluster_delete_volume - Delete a volume (must be offline first)
	registry.Register(
		"cluster_delete_volume",
		"Delete a volume on a registered cluster by cluster name (must be offline first). WARNING: This action is irreversible and will permanently destroy all data.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteVolume(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted volume %s", volumeUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 6. cluster_get_volume_stats - Get volume statistics
	registry.Register(
		"cluster_get_volume_stats",
		"Get volume statistics from a registered cluster by cluster name",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume to get statistics for",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			volume, err := client.GetVolume(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Volume Statistics for %s:\n", volume.Name)
			result += fmt.Sprintf("UUID: %s\n", volume.UUID)
			result += fmt.Sprintf("State: %s\n", volume.State)
			if volume.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", volume.SVM.Name)
			}
			if volume.Space != nil {
				sizeTB := float64(volume.Space.Size) / (1024 * 1024 * 1024 * 1024)
				availTB := float64(volume.Space.Available) / (1024 * 1024 * 1024 * 1024)
				usedTB := float64(volume.Space.Used) / (1024 * 1024 * 1024 * 1024)
				usedPercent := float64(volume.Space.Used) / float64(volume.Space.Size) * 100
				result += fmt.Sprintf("Size: %.2f TB\n", sizeTB)
				result += fmt.Sprintf("Used: %.2f TB (%.1f%%)\n", usedTB, usedPercent)
				result += fmt.Sprintf("Available: %.2f TB\n", availTB)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 7. cluster_get_volume_configuration - Get comprehensive volume configuration
	registry.Register(
		"cluster_get_volume_configuration",
		"Get comprehensive configuration information for a volume on a registered cluster including policies, security, and efficiency settings",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			volume, err := client.GetVolume(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("💾 Volume Configuration: %s\n\n", volume.Name)
			result += fmt.Sprintf("UUID: %s\n", volume.UUID)
			result += fmt.Sprintf("State: %s\n", volume.State)
			result += fmt.Sprintf("Type: %s\n", volume.Type)
			
			if volume.SVM != nil {
				result += fmt.Sprintf("SVM: %s (%s)\n", volume.SVM.Name, volume.SVM.UUID)
			}
			
			if volume.Space != nil {
				sizeTB := float64(volume.Space.Size) / (1024 * 1024 * 1024 * 1024)
				result += fmt.Sprintf("Size: %.2f TB\n", sizeTB)
			}
			
			if volume.NAS != nil {
				result += fmt.Sprintf("\n🔒 Security Style: %s\n", volume.NAS.SecurityStyle)
				if volume.NAS.ExportPolicy != nil {
					result += fmt.Sprintf("Export Policy: %s\n", volume.NAS.ExportPolicy.Name)
				}
			}
			
			if volume.QoS != nil && volume.QoS.Policy != nil {
				result += fmt.Sprintf("\n📊 QoS Policy: %s\n", volume.QoS.Policy.Name)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 8. cluster_create_qos_policy - Create a QoS policy
	registry.Register(
		"cluster_create_qos_policy",
		"Create a QoS policy group (fixed or adaptive) on a registered cluster",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_name", "svm_name", "policy_type"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "QoS policy name",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy will be created",
				},
				"policy_type": map[string]interface{}{
					"type":        "string",
					"description": "Type of QoS policy: 'fixed' for absolute limits or 'adaptive' for scaling limits",
					"enum":        []string{"fixed", "adaptive"},
				},
				"max_throughput_iops": map[string]interface{}{
					"type":        "number",
					"description": "Maximum throughput in IOPS (fixed policy only)",
				},
				"min_throughput_iops": map[string]interface{}{
					"type":        "number",
					"description": "Minimum guaranteed throughput in IOPS (fixed policy only)",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyName := args["policy_name"].(string)
			svmName := args["svm_name"].(string)
			policyType := args["policy_type"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			req := map[string]interface{}{
				"name": policyName,
				"svm":  map[string]string{"name": svmName},
			}

			if policyType == "fixed" {
				fixed := make(map[string]interface{})
				if maxIOPS, ok := args["max_throughput_iops"].(float64); ok {
					fixed["max_throughput_iops"] = int64(maxIOPS)
				}
				if minIOPS, ok := args["min_throughput_iops"].(float64); ok {
					fixed["min_throughput_iops"] = int64(minIOPS)
				}
				if len(fixed) > 0 {
					req["fixed"] = fixed
				}
			}

			err = client.CreateQoSPolicy(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully created QoS policy '%s' on SVM '%s'", policyName, svmName)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 9. cluster_update_qos_policy - Update a QoS policy
	registry.Register(
		"cluster_update_qos_policy",
		"Update an existing QoS policy group's limits on a registered cluster",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the QoS policy to update",
				},
				"max_throughput_iops": map[string]interface{}{
					"type":        "number",
					"description": "New maximum throughput in IOPS",
				},
				"min_throughput_iops": map[string]interface{}{
					"type":        "number",
					"description": "New minimum throughput in IOPS",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyUUID := args["policy_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			updates := make(map[string]interface{})
			fixed := make(map[string]interface{})

			if maxIOPS, ok := args["max_throughput_iops"].(float64); ok {
				fixed["max_throughput_iops"] = int64(maxIOPS)
			}
			if minIOPS, ok := args["min_throughput_iops"].(float64); ok {
				fixed["min_throughput_iops"] = int64(minIOPS)
			}

			if len(fixed) > 0 {
				updates["fixed"] = fixed
			}

			if len(updates) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No updates specified"}},
				}, nil
			}

			err = client.UpdateQoSPolicy(ctx, policyUUID, updates)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to update QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully updated QoS policy %s", policyUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// ====================
	// Dual-Mode Volume Tools (support both registry and direct credentials)
	// ====================

	// resize_volume - Resize a volume (dual-mode)
	registry.Register(
		"resize_volume",
		"Resize a volume to a new size. Can only increase size (ONTAP doesn't support shrinking volumes with data)",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid", "new_size"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"new_size": map[string]interface{}{
					"type":        "string",
					"description": "New size for the volume (e.g., '500GB', '2TB')",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get client: %v", err))},
					IsError: true,
				}, nil
			}

			volumeUUID := args["volume_uuid"].(string)
			newSize := args["new_size"].(string)

			// Parse size
			var sizeBytes int64
			if len(newSize) > 2 {
				unit := newSize[len(newSize)-2:]
				numStr := newSize[:len(newSize)-2]
				var num float64
				fmt.Sscanf(numStr, "%f", &num)
				if unit == "GB" {
					sizeBytes = int64(num * 1024 * 1024 * 1024)
				} else if unit == "TB" {
					sizeBytes = int64(num * 1024 * 1024 * 1024 * 1024)
				}
			}

			updates := map[string]interface{}{
				"size": sizeBytes,
			}

			err = client.UpdateVolume(ctx, volumeUUID, updates)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to resize volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully resized volume %s to %s", volumeUUID, newSize)
			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// update_volume - Update volume properties (dual-mode)
	registry.Register(
		"update_volume",
		"Update multiple volume properties in a single operation",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume to update",
				},
				"size": map[string]interface{}{
					"type":        "string",
					"description": "New size (e.g., '500GB', '2TB') - can only increase",
				},
				"comment": map[string]interface{}{
					"type":        "string",
					"description": "New comment/description",
				},
				"state": map[string]interface{}{
					"type":        "string",
					"description": "Volume state: 'online', 'offline', or 'restricted'",
					"enum":        []string{"online", "offline", "restricted"},
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get client: %v", err))},
					IsError: true,
				}, nil
			}

			volumeUUID := args["volume_uuid"].(string)
			updates := make(map[string]interface{})

			if size, ok := args["size"].(string); ok {
				var sizeBytes int64
				if len(size) > 2 {
					unit := size[len(size)-2:]
					numStr := size[:len(size)-2]
					var num float64
					fmt.Sscanf(numStr, "%f", &num)
					if unit == "GB" {
						sizeBytes = int64(num * 1024 * 1024 * 1024)
					} else if unit == "TB" {
						sizeBytes = int64(num * 1024 * 1024 * 1024 * 1024)
					}
				}
				updates["size"] = sizeBytes
			}

			if comment, ok := args["comment"].(string); ok {
				updates["comment"] = comment
			}

			if state, ok := args["state"].(string); ok {
				updates["state"] = state
			}

			err = client.UpdateVolume(ctx, volumeUUID, updates)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to update volume: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully updated volume %s", volumeUUID)
			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// update_volume_comment - Update volume comment (dual-mode)
	registry.Register(
		"update_volume_comment",
		"Update the comment/description field of a volume",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
				"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
				"username":     map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
				"password":     map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
				"volume_uuid":  map[string]interface{}{"type": "string", "description": "UUID of the volume"},
				"comment":      map[string]interface{}{"type": "string", "description": "New comment/description (or empty to clear)"},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
			}
			volumeUUID := args["volume_uuid"].(string)
			comment := ""
			if c, ok := args["comment"].(string); ok {
				comment = c
			}
			err = client.UpdateVolume(ctx, volumeUUID, map[string]interface{}{"comment": comment})
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
			}
			return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Updated comment for volume %s", volumeUUID)}}}, nil
		},
	)

	// update_volume_security_style - Update volume security style (dual-mode)
	registry.Register(
		"update_volume_security_style",
		"Update the security style of a volume (unix, ntfs, mixed, unified)",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid", "security_style"},
			"properties": map[string]interface{}{
				"cluster_name":   map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
				"cluster_ip":     map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
				"username":       map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
				"password":       map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
				"volume_uuid":    map[string]interface{}{"type": "string", "description": "UUID of the volume"},
				"security_style": map[string]interface{}{"type": "string", "description": "New security style", "enum": []string{"unix", "ntfs", "mixed", "unified"}},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
			}
			volumeUUID := args["volume_uuid"].(string)
			securityStyle := args["security_style"].(string)
			err = client.UpdateVolume(ctx, volumeUUID, map[string]interface{}{"nas": map[string]interface{}{"security_style": securityStyle}})
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
			}
			return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Updated security style to %s for volume %s", securityStyle, volumeUUID)}}}, nil
		},
	)

	// get_volume_configuration - Get comprehensive volume configuration (dual-mode)
	registry.Register(
		"get_volume_configuration",
		"Get comprehensive configuration information for a volume including policies, security, and efficiency settings",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
				"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
				"username":     map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
				"password":     map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
				"volume_uuid":  map[string]interface{}{"type": "string", "description": "UUID of the volume"},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
			}
			volumeUUID := args["volume_uuid"].(string)
			volume, err := client.GetVolume(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
			}
			result := fmt.Sprintf("Volume: %s\nUUID: %s\nState: %s\n", volume.Name, volume.UUID, volume.State)
			if volume.Space != nil {
				result += fmt.Sprintf("Size: %d bytes\n", volume.Space.Size)
			}
			if volume.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", volume.SVM.Name)
			}
			return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
		},
	)

	// configure_volume_nfs_access - Configure NFS access (dual-mode)
	registry.Register(
		"configure_volume_nfs_access",
		"Configure NFS access for a volume by applying an export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid", "export_policy_name"},
			"properties": map[string]interface{}{
				"cluster_name":        map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
				"cluster_ip":          map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
				"username":            map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
				"password":            map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
				"volume_uuid":         map[string]interface{}{"type": "string", "description": "UUID of the volume"},
				"export_policy_name":  map[string]interface{}{"type": "string", "description": "Name of the export policy to apply"},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
			}
			volumeUUID := args["volume_uuid"].(string)
			policyName := args["export_policy_name"].(string)
			err = client.UpdateVolume(ctx, volumeUUID, map[string]interface{}{"nas": map[string]interface{}{"export_policy": map[string]string{"name": policyName}}})
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
			}
			return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Applied export policy '%s' to volume %s", policyName, volumeUUID)}}}, nil
		},
	)

	// disable_volume_nfs_access - Disable NFS access (dual-mode)
	registry.Register(
		"disable_volume_nfs_access",
		"Disable NFS access for a volume (reverts to default export policy)",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
				"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
				"username":     map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
				"password":     map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
				"volume_uuid":  map[string]interface{}{"type": "string", "description": "UUID of the volume"},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(clusterManager, args)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
			}
			volumeUUID := args["volume_uuid"].(string)
			err = client.UpdateVolume(ctx, volumeUUID, map[string]interface{}{"nas": map[string]interface{}{"export_policy": map[string]string{"name": "default"}}})
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
			}
			return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Disabled NFS access for volume %s (reverted to default policy)", volumeUUID)}}}, nil
		},
	)

	// Note: Additional dual-mode volume tools (update_volume_comment, update_volume_security_style, etc.) 
	// can be added following the same pattern
}

func registerCIFSTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_list_cifs_shares - List CIFS shares
	registry.Register(
		"cluster_list_cifs_shares",
		"List all CIFS shares from a registered cluster by name",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Filter by SVM name",
				},
				"share_name_pattern": map[string]interface{}{
					"type":        "string",
					"description": "Filter by share name pattern",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := ""
			shareName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}
			if share, ok := args["share_name_pattern"].(string); ok {
				shareName = share
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			shares, err := client.ListCIFSShares(ctx, svmName, shareName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list CIFS shares: %v", err))},
					IsError: true,
				}, nil
			}

			if len(shares) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No CIFS shares found"}},
				}, nil
			}

			result := fmt.Sprintf("CIFS Shares on cluster '%s' (%d):\n", clusterName, len(shares))
			for _, share := range shares {
				result += fmt.Sprintf("- %s: %s", share.Name, share.Path)
				if share.SVM != nil {
					result += fmt.Sprintf(" (SVM: %s)", share.SVM.Name)
				}
				if share.Comment != "" {
					result += fmt.Sprintf(" - %s", share.Comment)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. cluster_create_cifs_share - Create a CIFS share
	registry.Register(
		"cluster_create_cifs_share",
		"Create a new CIFS share on a registered cluster by name",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "name", "path", "svm_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "CIFS share name",
				},
				"path": map[string]interface{}{
					"type":        "string",
					"description": "Volume path (typically /vol/volume_name)",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where share will be created",
				},
				"comment": map[string]interface{}{
					"type":        "string",
					"description": "Optional share comment",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			name := args["name"].(string)
			path := args["path"].(string)
			svmName := args["svm_name"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			req := map[string]interface{}{
				"name": name,
				"path": path,
				"svm":  map[string]string{"name": svmName},
			}

			if comment, ok := args["comment"].(string); ok {
				req["comment"] = comment
			}

			err = client.CreateCIFSShare(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create CIFS share: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully created CIFS share '%s' on SVM '%s'", name, svmName)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. cluster_delete_cifs_share - Delete a CIFS share
	registry.Register(
		"cluster_delete_cifs_share",
		"Delete a CIFS share from a registered cluster. WARNING: This will remove client access to the share.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "name", "svm_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "CIFS share name",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where share exists",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			name := args["name"].(string)
			svmName := args["svm_name"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			// First get SVM UUID
			svm, err := client.GetSVM(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get SVM: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteCIFSShare(ctx, svm.UUID, name)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete CIFS share: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted CIFS share '%s' from SVM '%s'", name, svmName)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 4. cluster_get_cifs_share - Get CIFS share details
	registry.Register(
		"cluster_get_cifs_share",
		"Get detailed information about a specific CIFS share",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "name", "svm_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "CIFS share name",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where share exists",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			name := args["name"].(string)
			svmName := args["svm_name"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			// Get SVM UUID
			svm, err := client.GetSVM(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get SVM: %v", err))},
					IsError: true,
				}, nil
			}

			share, err := client.GetCIFSShare(ctx, svm.UUID, name)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get CIFS share: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("CIFS Share: %s\n", share.Name)
			result += fmt.Sprintf("Path: %s\n", share.Path)
			if share.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", share.SVM.Name)
			}
			if share.Comment != "" {
				result += fmt.Sprintf("Comment: %s\n", share.Comment)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// ====================
	// Dual-Mode CIFS Tools (support both registry and direct credentials)
	// ====================

	// create_cifs_share - Create CIFS share (dual-mode)
	registry.Register("create_cifs_share", "Create a new CIFS share with specified access permissions", map[string]interface{}{
		"type": "object", "required": []string{"name", "path", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
			"cluster_ip": map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
			"username": map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
			"password": map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
			"name": map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"path": map[string]interface{}{"type": "string", "description": "Volume path (typically /vol/volume_name)"},
			"svm_name": map[string]interface{}{"type": "string", "description": "SVM name where share will be created"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		name, path, svmName := args["name"].(string), args["path"].(string), args["svm_name"].(string)
		req := map[string]interface{}{"name": name, "path": path, "svm": map[string]string{"name": svmName}}
		if err := client.CreateCIFSShare(ctx, req); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Created CIFS share '%s' at path '%s'", name, path)}}}, nil
	})

	// delete_cifs_share - Delete CIFS share (dual-mode)
	registry.Register("delete_cifs_share", "Delete a CIFS share. WARNING: This will remove client access", map[string]interface{}{
		"type": "object", "required": []string{"name", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string", "description": "Registry mode"},
			"cluster_ip": map[string]interface{}{"type": "string", "description": "Direct mode"},
			"username": map[string]interface{}{"type": "string", "description": "Direct mode"},
			"password": map[string]interface{}{"type": "string", "description": "Direct mode"},
			"name": map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"svm_name": map[string]interface{}{"type": "string", "description": "SVM name"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		if err := client.DeleteCIFSShare(ctx, args["svm_name"].(string), args["name"].(string)); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Deleted CIFS share '%s'", args["name"])}}}, nil
	})

	// get_cifs_share - Get CIFS share details (dual-mode)
	registry.Register("get_cifs_share", "Get detailed information about a specific CIFS share", map[string]interface{}{
		"type": "object", "required": []string{"name", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"name": map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"svm_name": map[string]interface{}{"type": "string", "description": "SVM name"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		share, err := client.GetCIFSShare(ctx, args["svm_name"].(string), args["name"].(string))
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		result := fmt.Sprintf("CIFS Share: %s\nPath: %s\nSVM: %s\n", share.Name, share.Path, share.SVM.Name)
		return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
	})

	// list_cifs_shares - List CIFS shares (dual-mode)
	registry.Register("list_cifs_shares", "List all CIFS shares in the cluster or filtered by SVM", map[string]interface{}{
		"type": "object", "required": []string{},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"svm_name": map[string]interface{}{"type": "string", "description": "Filter by SVM"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		svmName := ""
		if s, ok := args["svm_name"].(string); ok {
			svmName = s
		}
		shares, err := client.ListCIFSShares(ctx, svmName, "")
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		result := fmt.Sprintf("CIFS Shares (%d):\n", len(shares))
		for _, s := range shares {
			result += fmt.Sprintf("- %s: %s (SVM: %s)\n", s.Name, s.Path, s.SVM.Name)
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
	})

	// update_cifs_share - Update CIFS share (dual-mode)
	registry.Register("update_cifs_share", "Update an existing CIFS share's properties", map[string]interface{}{
		"type": "object", "required": []string{"name", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"name": map[string]interface{}{"type": "string"}, "svm_name": map[string]interface{}{"type": "string"},
			"comment": map[string]interface{}{"type": "string", "description": "Updated share comment"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		updates := make(map[string]interface{})
		if comment, ok := args["comment"].(string); ok {
			updates["comment"] = comment
		}
		if err := client.UpdateCIFSShare(ctx, args["svm_name"].(string), args["name"].(string), updates); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Updated CIFS share '%s'", args["name"])}}}, nil
	})
}

func registerExportPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_export_policies - List NFS export policies
	registry.Register(
		"list_export_policies",
		"List all NFS export policies on an ONTAP cluster, optionally filtered by SVM or name pattern",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Filter by SVM name",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			if len(policies) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No export policies found"}},
				}, nil
			}

			result := fmt.Sprintf("Export Policies on cluster '%s' (%d):\n", clusterName, len(policies))
			for _, policy := range policies {
				result += fmt.Sprintf("- %s (ID: %d)", policy.Name, policy.ID)
				if policy.SVM != nil {
					result += fmt.Sprintf(" - SVM: %s", policy.SVM.Name)
				}
				if len(policy.Rules) > 0 {
					result += fmt.Sprintf(", Rules: %d", len(policy.Rules))
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. get_export_policy - Get export policy details with rules
	registry.Register(
		"get_export_policy",
		"Get detailed information about a specific export policy including all rules",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_id"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_id": map[string]interface{}{
					"type":        "number",
					"description": "ID of the export policy",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyID := int(args["policy_id"].(float64))

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policy, err := client.GetExportPolicy(ctx, policyID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Export Policy: %s (ID: %d)\n", policy.Name, policy.ID)
			if policy.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", policy.SVM.Name)
			}
			result += fmt.Sprintf("Rules: %d\n", len(policy.Rules))
			
			for _, rule := range policy.Rules {
				result += fmt.Sprintf("\nRule %d:\n", rule.Index)
				result += "  Clients: "
				for i, client := range rule.Clients {
					if i > 0 {
						result += ", "
					}
					result += client.Match
				}
				result += fmt.Sprintf("\n  Protocols: %v\n", rule.Protocols)
				result += fmt.Sprintf("  RO Rule: %v\n", rule.RoRule)
				result += fmt.Sprintf("  RW Rule: %v\n", rule.RwRule)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. create_export_policy - Create a new export policy
	registry.Register(
		"create_export_policy",
		"Create a new NFS export policy (rules must be added separately)",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_name", "svm_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name for the export policy",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy will be created",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyName := args["policy_name"].(string)
			svmName := args["svm_name"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			req := map[string]interface{}{
				"name": policyName,
				"svm":  map[string]string{"name": svmName},
			}

			err = client.CreateExportPolicy(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully created export policy '%s' on SVM '%s'", policyName, svmName)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 4. delete_export_policy - Delete an export policy
	registry.Register(
		"delete_export_policy",
		"Delete an NFS export policy. Warning: Policy must not be in use by any volumes.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_id"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_id": map[string]interface{}{
					"type":        "number",
					"description": "ID of the export policy to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyID := int(args["policy_id"].(float64))

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteExportPolicy(ctx, policyID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted export policy ID %d", policyID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 5. add_export_rule - Add a rule to an export policy
	registry.Register(
		"add_export_rule",
		"Add a new export rule to an existing export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_id", "clients"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_id": map[string]interface{}{
					"type":        "number",
					"description": "ID of the export policy",
				},
				"clients": map[string]interface{}{
					"type":        "array",
					"description": "Client specifications (e.g., ['0.0.0.0/0', '10.0.0.0/8'])",
					"items": map[string]interface{}{
						"type": "string",
					},
				},
				"protocols": map[string]interface{}{
					"type":        "array",
					"description": "Allowed NFS protocols",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "nfs", "nfs3", "nfs4"},
					},
				},
				"ro_rule": map[string]interface{}{
					"type":        "array",
					"description": "Read-only access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "sys", "krb5"},
					},
				},
				"rw_rule": map[string]interface{}{
					"type":        "array",
					"description": "Read-write access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "sys", "krb5"},
					},
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyID := int(args["policy_id"].(float64))

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			rule := make(map[string]interface{})

			// Parse clients
			if clientsRaw, ok := args["clients"].([]interface{}); ok {
				clients := make([]map[string]string, len(clientsRaw))
				for i, c := range clientsRaw {
					clients[i] = map[string]string{"match": c.(string)}
				}
				rule["clients"] = clients
			}

			// Parse protocols
			if protocolsRaw, ok := args["protocols"].([]interface{}); ok {
				protocols := make([]string, len(protocolsRaw))
				for i, p := range protocolsRaw {
					protocols[i] = p.(string)
				}
				rule["protocols"] = protocols
			}

			// Parse ro_rule
			if roRaw, ok := args["ro_rule"].([]interface{}); ok {
				ro := make([]string, len(roRaw))
				for i, r := range roRaw {
					ro[i] = r.(string)
				}
				rule["ro_rule"] = ro
			}

			// Parse rw_rule
			if rwRaw, ok := args["rw_rule"].([]interface{}); ok {
				rw := make([]string, len(rwRaw))
				for i, r := range rwRaw {
					rw[i] = r.(string)
				}
				rule["rw_rule"] = rw
			}

			err = client.AddExportRule(ctx, policyID, rule)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to add export rule: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully added export rule to policy ID %d", policyID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Note: delete_export_rule and update_export_rule require policy ID resolution
	// which is better handled at the cluster_ prefix level for now
}

func registerSnapshotPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_snapshot_policies - List snapshot policies
	registry.Register(
		"list_snapshot_policies",
		"List all snapshot policies on an ONTAP cluster, optionally filtered by SVM or name pattern",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Filter by SVM name",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policies, err := client.ListSnapshotPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list snapshot policies: %v", err))},
					IsError: true,
				}, nil
			}

			if len(policies) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No snapshot policies found"}},
				}, nil
			}

			result := fmt.Sprintf("Snapshot Policies on cluster '%s' (%d):\n", clusterName, len(policies))
			for _, policy := range policies {
				result += fmt.Sprintf("- %s (%s)", policy.Name, policy.UUID)
				if policy.SVM != nil {
					result += fmt.Sprintf(" - SVM: %s", policy.SVM.Name)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 4. create_snapshot_policy - Create a snapshot policy
	registry.Register(
		"create_snapshot_policy",
		"Create a new snapshot policy with specified copies configuration",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_name", "svm_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name for the snapshot policy",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy will be created",
				},
				"enabled": map[string]interface{}{
					"type":        "boolean",
					"description": "Whether the policy should be enabled",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyName := args["policy_name"].(string)
			svmName := args["svm_name"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			req := map[string]interface{}{
				"name": policyName,
				"svm":  map[string]string{"name": svmName},
			}

			if enabled, ok := args["enabled"].(bool); ok {
				req["enabled"] = enabled
			}

			err = client.CreateSnapshotPolicy(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create snapshot policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully created snapshot policy '%s' on SVM '%s'", policyName, svmName)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. get_snapshot_policy - Get snapshot policy details
	registry.Register(
		"get_snapshot_policy",
		"Get detailed information about a specific snapshot policy by name or UUID",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the snapshot policy",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyUUID := args["policy_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policy, err := client.GetSnapshotPolicy(ctx, policyUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get snapshot policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Snapshot Policy: %s\n", policy.Name)
			result += fmt.Sprintf("UUID: %s\n", policy.UUID)
			result += fmt.Sprintf("Enabled: %v\n", policy.Enabled)
			if policy.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", policy.SVM.Name)
			}
			if policy.Comment != "" {
				result += fmt.Sprintf("Comment: %s\n", policy.Comment)
			}
			result += fmt.Sprintf("Copies: %d\n", len(policy.Copies))

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. delete_snapshot_policy - Delete a snapshot policy
	registry.Register(
		"delete_snapshot_policy",
		"Delete a snapshot policy. WARNING: Policy must not be in use by any volumes.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the snapshot policy to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyUUID := args["policy_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteSnapshotPolicy(ctx, policyUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete snapshot policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted snapshot policy %s", policyUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Note: create_snapshot_policy can be added following the same pattern
}

func registerQoSPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_list_qos_policies - List QoS policies
	registry.Register(
		"cluster_list_qos_policies",
		"List QoS policy groups on a registered ONTAP cluster, optionally filtered by SVM or policy name pattern",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Filter by SVM name",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policies, err := client.ListQoSPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list QoS policies: %v", err))},
					IsError: true,
				}, nil
			}

			if len(policies) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No QoS policies found"}},
				}, nil
			}

			result := fmt.Sprintf("QoS Policies on cluster '%s' (%d):\n", clusterName, len(policies))
			for _, policy := range policies {
				result += fmt.Sprintf("- %s (%s)", policy.Name, policy.UUID)
				if policy.SVM != nil {
					result += fmt.Sprintf(" - SVM: %s", policy.SVM.Name)
				}
				result += fmt.Sprintf(", Class: %s", policy.PolicyClass)
				if policy.Fixed != nil {
					if policy.Fixed.MaxThroughputIOPS > 0 {
						result += fmt.Sprintf(", Max: %d IOPS", policy.Fixed.MaxThroughputIOPS)
					}
					if policy.Fixed.MinThroughputIOPS > 0 {
						result += fmt.Sprintf(", Min: %d IOPS", policy.Fixed.MinThroughputIOPS)
					}
				}
				if policy.Adaptive != nil {
					if policy.Adaptive.PeakIOPS > 0 {
						result += fmt.Sprintf(", Peak: %d IOPS", policy.Adaptive.PeakIOPS)
					}
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. cluster_get_qos_policy - Get QoS policy details
	registry.Register(
		"cluster_get_qos_policy",
		"Get detailed information about a specific QoS policy group on a registered cluster",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the QoS policy",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyUUID := args["policy_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policy, err := client.GetQoSPolicy(ctx, policyUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("QoS Policy: %s\n", policy.Name)
			result += fmt.Sprintf("UUID: %s\n", policy.UUID)
			if policy.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", policy.SVM.Name)
			}
			result += fmt.Sprintf("Class: %s\n", policy.PolicyClass)
			
			if policy.Fixed != nil {
				result += "Type: Fixed\n"
				if policy.Fixed.MaxThroughputIOPS > 0 {
					result += fmt.Sprintf("  Max Throughput: %d IOPS\n", policy.Fixed.MaxThroughputIOPS)
				}
				if policy.Fixed.MinThroughputIOPS > 0 {
					result += fmt.Sprintf("  Min Throughput: %d IOPS\n", policy.Fixed.MinThroughputIOPS)
				}
			}
			
			if policy.Adaptive != nil {
				result += "Type: Adaptive\n"
				if policy.Adaptive.PeakIOPS > 0 {
					result += fmt.Sprintf("  Peak IOPS: %d\n", policy.Adaptive.PeakIOPS)
				}
				if policy.Adaptive.ExpectedIOPS > 0 {
					result += fmt.Sprintf("  Expected IOPS: %d\n", policy.Adaptive.ExpectedIOPS)
				}
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. cluster_delete_qos_policy - Delete a QoS policy
	registry.Register(
		"cluster_delete_qos_policy",
		"Delete a QoS policy group from a registered cluster. WARNING: Policy must not be in use by any workloads.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the QoS policy to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyUUID := args["policy_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteQoSPolicy(ctx, policyUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted QoS policy %s", policyUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Note: Remaining QoS tools (2 more): cluster_create_qos_policy, cluster_update_qos_policy
}

func registerVolumeSnapshotTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_list_volume_snapshots - List snapshots for a volume
	registry.Register(
		"cluster_list_volume_snapshots",
		"List all snapshots for a volume on a registered cluster. Snapshots can be sorted by creation time, size, or name.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			snapshots, err := client.ListVolumeSnapshots(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list volume snapshots: %v", err))},
					IsError: true,
				}, nil
			}

			if len(snapshots) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No snapshots found"}},
				}, nil
			}

			result := fmt.Sprintf("Snapshots for volume %s (%d):\n", volumeUUID, len(snapshots))
			for _, snap := range snapshots {
				result += fmt.Sprintf("- %s (%s)", snap.Name, snap.UUID)
				result += fmt.Sprintf(", Created: %s", snap.CreateTime)
				if snap.Size > 0 {
					sizeGB := float64(snap.Size) / (1024 * 1024 * 1024)
					result += fmt.Sprintf(", Size: %.2f GB", sizeGB)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. cluster_delete_volume_snapshot - Delete a volume snapshot
	registry.Register(
		"cluster_delete_volume_snapshot",
		"Delete a volume snapshot on a registered cluster to reclaim space. WARNING: This permanently removes the snapshot and cannot be undone.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid", "snapshot_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"snapshot_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the snapshot to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)
			snapshotUUID := args["snapshot_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteVolumeSnapshot(ctx, volumeUUID, snapshotUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete snapshot: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted snapshot %s from volume %s", snapshotUUID, volumeUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. cluster_get_volume_snapshot_info - Get snapshot details
	registry.Register(
		"cluster_get_volume_snapshot_info",
		"Get detailed information about a specific volume snapshot on a registered cluster, including creation time, size, state, and any comments.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid", "snapshot_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"snapshot_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the snapshot",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)
			snapshotUUID := args["snapshot_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			snapshot, err := client.GetVolumeSnapshot(ctx, volumeUUID, snapshotUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get snapshot: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Snapshot: %s\n", snapshot.Name)
			result += fmt.Sprintf("UUID: %s\n", snapshot.UUID)
			result += fmt.Sprintf("Created: %s\n", snapshot.CreateTime)
			result += fmt.Sprintf("State: %s\n", snapshot.State)
			if snapshot.Size > 0 {
				sizeGB := float64(snapshot.Size) / (1024 * 1024 * 1024)
				result += fmt.Sprintf("Size: %.2f GB\n", sizeGB)
			}
			if snapshot.Comment != "" {
				result += fmt.Sprintf("Comment: %s\n", snapshot.Comment)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}

func registerVolumeAutosizeTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_get_volume_autosize_status - Get autosize configuration
	registry.Register(
		"cluster_get_volume_autosize_status",
		"Get the current autosize configuration and status for a volume on a registered cluster, including current size, limits, and space usage.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			autosize, err := client.GetVolumeAutosize(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get volume autosize: %v", err))},
					IsError: true,
				}, nil
			}

			result := "Volume Autosize Configuration:\n"
			result += fmt.Sprintf("Mode: %s\n", autosize.Mode)
			if autosize.Maximum > 0 {
				maxTB := float64(autosize.Maximum) / (1024 * 1024 * 1024 * 1024)
				result += fmt.Sprintf("Maximum: %.2f TB\n", maxTB)
			}
			if autosize.Minimum > 0 {
				minTB := float64(autosize.Minimum) / (1024 * 1024 * 1024 * 1024)
				result += fmt.Sprintf("Minimum: %.2f TB\n", minTB)
			}
			if autosize.GrowThreshold > 0 {
				result += fmt.Sprintf("Grow Threshold: %d%%\n", autosize.GrowThreshold)
			}
			if autosize.ShrinkThreshold > 0 {
				result += fmt.Sprintf("Shrink Threshold: %d%%\n", autosize.ShrinkThreshold)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. cluster_enable_volume_autosize - Configure volume autosize
	registry.Register(
		"cluster_enable_volume_autosize",
		"Enable or configure volume autosize on a registered cluster. Autosize automatically adjusts volume size based on utilization.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid", "mode"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"mode": map[string]interface{}{
					"type":        "string",
					"description": "Autosize mode: 'off' to disable, 'grow' for growth only, 'grow_shrink' for both",
					"enum":        []string{"off", "grow", "grow_shrink"},
				},
				"maximum_size": map[string]interface{}{
					"type":        "string",
					"description": "Maximum size (e.g., '1TB', '500GB')",
				},
				"grow_threshold": map[string]interface{}{
					"type":        "number",
					"description": "Percentage full to trigger growth (default: 85)",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)
			mode := args["mode"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			config := map[string]interface{}{
				"mode": mode,
			}

			if maxSize, ok := args["maximum_size"].(string); ok {
				// Parse size
				var sizeBytes int64
				if len(maxSize) > 2 {
					unit := maxSize[len(maxSize)-2:]
					numStr := maxSize[:len(maxSize)-2]
					var num float64
					fmt.Sscanf(numStr, "%f", &num)
					if unit == "GB" {
						sizeBytes = int64(num * 1024 * 1024 * 1024)
					} else if unit == "TB" {
						sizeBytes = int64(num * 1024 * 1024 * 1024 * 1024)
					}
				}
				config["maximum"] = sizeBytes
			}

			if growThresh, ok := args["grow_threshold"].(float64); ok {
				config["grow_threshold"] = int(growThresh)
			}

			err = client.EnableVolumeAutosize(ctx, volumeUUID, config)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to configure autosize: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully configured autosize for volume %s (mode: %s)", volumeUUID, mode)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}

func registerSnapshotScheduleTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// list_snapshot_schedules - List all snapshot schedules (dual-mode)
	registry.Register("list_snapshot_schedules", "List all snapshot schedules (cron jobs) on an ONTAP cluster", map[string]interface{}{
		"type": "object", "required": []string{},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		result := fmt.Sprintf("Snapshot Schedules (%d):\n", len(schedules))
		for _, s := range schedules {
			result += fmt.Sprintf("- %s (%s)\n", s.Name, s.UUID)
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
	})

	// get_snapshot_schedule - Get snapshot schedule details (dual-mode)
	registry.Register("get_snapshot_schedule", "Get detailed information about a specific snapshot schedule by name", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name of the snapshot schedule"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		scheduleName := args["schedule_name"].(string)
		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				result := fmt.Sprintf("Schedule: %s\nUUID: %s\nType: %s\n", s.Name, s.UUID, s.Type)
				return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})

	// create_snapshot_schedule - Create new snapshot schedule (dual-mode)
	registry.Register("create_snapshot_schedule", "Create a new snapshot schedule (cron job) for use in snapshot policies", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name", "schedule_type"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name for the snapshot schedule"},
			"schedule_type": map[string]interface{}{"type": "string", "description": "Type: 'cron' or 'interval'", "enum": []string{"cron", "interval"}},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		req := map[string]interface{}{
			"name": args["schedule_name"].(string),
			"type": args["schedule_type"].(string),
		}
		if err := client.CreateSnapshotSchedule(ctx, req); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Created schedule '%s'", args["schedule_name"])}}}, nil
	})

	// delete_snapshot_schedule - Delete snapshot schedule (dual-mode)
	registry.Register("delete_snapshot_schedule", "Delete a snapshot schedule. WARNING: Schedule must not be in use by any policies", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name of the schedule to delete"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		scheduleName := args["schedule_name"].(string)
		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				if err := client.DeleteSnapshotSchedule(ctx, s.UUID); err != nil {
					return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
				}
				return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Deleted schedule '%s'", scheduleName)}}}, nil
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})

	// update_snapshot_schedule - Update snapshot schedule (dual-mode)
	registry.Register("update_snapshot_schedule", "Update an existing snapshot schedule's configuration", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name of the schedule to update"},
			"new_name": map[string]interface{}{"type": "string", "description": "New name for the schedule"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		scheduleName := args["schedule_name"].(string)
		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				updates := make(map[string]interface{})
				if newName, ok := args["new_name"].(string); ok {
					updates["name"] = newName
				}
				if err := client.UpdateSnapshotSchedule(ctx, s.UUID, updates); err != nil {
					return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
				}
				return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Updated schedule '%s'", scheduleName)}}}, nil
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})
}
