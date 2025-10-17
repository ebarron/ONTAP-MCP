package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// toJSONString converts a value to JSON string
func toJSONString(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// formatBytes formats a byte count in human-readable format (matches TypeScript)
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.2f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func RegisterVolumeTools(registry *Registry, clusterManager *ontap.ClusterManager) {
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
				msg := fmt.Sprintf("No volumes found on cluster \"%s\"", clusterName)
				if svmName != "" {
					msg = fmt.Sprintf("No volumes found in SVM \"%s\" on cluster \"%s\"", svmName, clusterName)
				}
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: msg}},
				}, nil
			}

			// Build structured data array
			dataArray := make([]map[string]interface{}, 0, len(volumes))
			for _, vol := range volumes {
				item := map[string]interface{}{
					"uuid":  vol.UUID,
					"name":  vol.Name,
					"size":  vol.Space.Size,
					"state": vol.State,
				}
				if vol.SVM != nil {
					item["svm"] = map[string]interface{}{
						"name": vol.SVM.Name,
						"uuid": vol.SVM.UUID,
					}
				}
				if len(vol.Aggregates) > 0 {
					item["aggregate"] = map[string]interface{}{
						"name": vol.Aggregates[0].Name,
						"uuid": vol.Aggregates[0].UUID,
					}
				}
				dataArray = append(dataArray, item)
			}

			// Build human-readable summary (matches TypeScript format)
			summary := fmt.Sprintf("Volumes on cluster '%s': %d\n\n", clusterName, len(volumes))
			for _, vol := range volumes {
				svmName := "N/A"
				if vol.SVM != nil {
					svmName = vol.SVM.Name
				}
				summary += fmt.Sprintf("- %s (%s) - Size: %d, State: %s, SVM: %s\n",
					vol.Name, vol.UUID, vol.Space.Size, vol.State, svmName)
			}

			// Return hybrid format (Phase 2)
			return &CallToolResult{
				Content: []Content{{
					Type: "text",
					Text: fmt.Sprintf("%s\n__DATA__\n%s", summary, toJSONString(map[string]interface{}{
						"summary": summary,
						"data":    dataArray,
					})),
				}},
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

			// Build structured data array
			dataArray := make([]map[string]interface{}, 0, len(aggregates))
			for _, aggr := range aggregates {
				item := map[string]interface{}{
					"uuid":  aggr.UUID,
					"name":  aggr.Name,
					"state": aggr.State,
				}
				if aggr.Space != nil && aggr.Space.BlockStorage != nil {
					item["space"] = map[string]interface{}{
						"available": aggr.Space.BlockStorage.Available,
						"used":      aggr.Space.BlockStorage.Used,
						"size":      aggr.Space.BlockStorage.Size,
					}
					if aggr.Space.BlockStorage.Size > 0 {
						percentUsed := (aggr.Space.BlockStorage.Used * 100) / aggr.Space.BlockStorage.Size
						item["space"].(map[string]interface{})["percent_used"] = percentUsed
					}
				}
				dataArray = append(dataArray, item)
			}

			// Build human-readable summary
			summary := fmt.Sprintf("Aggregates on cluster '%s': %d\n\n", clusterName, len(aggregates))
			for _, aggr := range aggregates {
				summary += fmt.Sprintf("- %s (%s)", aggr.Name, aggr.UUID)
				if aggr.State != "" {
					summary += fmt.Sprintf(" - State: %s", aggr.State)
				}
				if aggr.Space != nil && aggr.Space.BlockStorage != nil {
					summary += fmt.Sprintf(", Available: %d, Used: %d",
						aggr.Space.BlockStorage.Available, aggr.Space.BlockStorage.Used)
				}
				summary += "\n"
			}

			// Return hybrid format (Phase 2, Step 3)
			return &CallToolResult{
				Content: []Content{{
					Type: "text",
					Text: fmt.Sprintf("%s\n__DATA__\n%s", summary, toJSONString(map[string]interface{}{
						"summary": summary,
						"data":    dataArray,
					})),
				}},
			}, nil
		},
	)

	// 3. cluster_create_volume - Create a volume on a cluster
	registry.Register(
		"cluster_create_volume",
		"Create a volume on a registered cluster by cluster name with optional CIFS share configuration",
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
				"qos_policy": map[string]interface{}{
					"type":        "string",
					"description": "Optional: QoS policy name (can be from volume's SVM or admin SVM)",
				},
				"cifs_share": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"share_name": map[string]interface{}{
							"type":        "string",
							"description": "CIFS share name",
						},
						"comment": map[string]interface{}{
							"type":        "string",
							"description": "Optional share comment",
						},
						"properties": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"access_based_enumeration": map[string]interface{}{
									"type":        "boolean",
									"description": "Enable access-based enumeration",
								},
								"encryption": map[string]interface{}{
									"type":        "boolean",
									"description": "Enable encryption",
								},
								"offline_files": map[string]interface{}{
									"type":        "string",
									"enum":        []string{"none", "manual", "documents", "programs"},
									"description": "Offline files policy",
								},
								"oplocks": map[string]interface{}{
									"type":        "boolean",
									"description": "Oplocks",
								},
							},
							"description": "Share properties",
						},
						"access_control": map[string]interface{}{
							"type": "array",
							"items": map[string]interface{}{
								"type": "object",
								"properties": map[string]interface{}{
									"permission": map[string]interface{}{
										"type":        "string",
										"enum":        []string{"no_access", "read", "change", "full_control"},
										"description": "Permission level",
									},
									"user_or_group": map[string]interface{}{
										"type":        "string",
										"description": "User or group name",
									},
									"type": map[string]interface{}{
										"type":        "string",
										"enum":        []string{"windows", "unix_user", "unix_group"},
										"description": "Type of user/group",
									},
								},
								"required": []string{"permission", "user_or_group"},
							},
							"description": "Access control entries",
						},
					},
					"required":    []string{"share_name"},
					"description": "Optional CIFS share configuration",
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

			// Parse size string (supports KB, MB, GB, TB)
			var sizeBytes int64
			sizeStr = strings.TrimSpace(sizeStr)

			// Try to match pattern like "100MB", "1.5GB", "2TB"
			var num float64
			var unit string

			// Extract number and unit
			for i := len(sizeStr) - 1; i >= 0; i-- {
				if sizeStr[i] >= '0' && sizeStr[i] <= '9' || sizeStr[i] == '.' {
					num, _ = strconv.ParseFloat(sizeStr[:i+1], 64)
					unit = strings.ToUpper(sizeStr[i+1:])
					break
				}
			}

			// Convert to bytes based on unit
			switch unit {
			case "KB":
				sizeBytes = int64(num * 1024)
			case "MB":
				sizeBytes = int64(num * 1024 * 1024)
			case "GB":
				sizeBytes = int64(num * 1024 * 1024 * 1024)
			case "TB":
				sizeBytes = int64(num * 1024 * 1024 * 1024 * 1024)
			default:
				// If no unit or unknown unit, try to parse as bytes
				sizeBytes, _ = strconv.ParseInt(sizeStr, 10, 64)
			}

			req := &ontap.CreateVolumeRequest{
				Name: volumeName,
				SVM:  map[string]string{"name": svmName},
				Size: sizeBytes,
			}

			if aggrName, ok := args["aggregate_name"].(string); ok && aggrName != "" {
				req.Aggregates = []map[string]string{{"name": aggrName}}
			}

			if qosPolicy, ok := args["qos_policy"].(string); ok && qosPolicy != "" {
				req.QoS = map[string]interface{}{"policy": map[string]string{"name": qosPolicy}}
			}

			response, err := client.CreateVolume(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create volume: %v", err))},
					IsError: true,
				}, nil
			}

			// Format output to match TypeScript
			result := fmt.Sprintf("✅ **Volume created successfully!**\n\n"+
				"🎯 **Cluster:** %s\n"+
				"📦 **Volume Name:** %s\n"+
				"🆔 **UUID:** %s\n"+
				"🏢 **SVM:** %s\n"+
				"📊 **Size:** %s\n",
				clusterName, volumeName, response.UUID, svmName, sizeStr)

			if aggrName, ok := args["aggregate_name"].(string); ok && aggrName != "" {
				result += fmt.Sprintf("📁 **Aggregate:** %s\n", aggrName)
			}

			if qosPolicy, ok := args["qos_policy"].(string); ok && qosPolicy != "" {
				result += fmt.Sprintf("🎯 **QoS Policy:** %s\n", qosPolicy)
			}

			if response.Job != nil {
				result += fmt.Sprintf("🔄 **Job UUID:** %s\n", response.Job.UUID)
			}

			// Handle CIFS share creation if specified
			if cifsShareArg, ok := args["cifs_share"].(map[string]interface{}); ok {
				shareName := cifsShareArg["share_name"].(string)
				sharePath := fmt.Sprintf("/vol/%s", volumeName)

				// Build CIFS share request
				cifsReq := map[string]interface{}{
					"name": shareName,
					"path": sharePath,
					"svm":  map[string]string{"name": svmName},
				}

				if comment, ok := cifsShareArg["comment"].(string); ok && comment != "" {
					cifsReq["comment"] = comment
				}

				// Create CIFS share
				cifsErr := client.CreateCIFSShare(ctx, cifsReq)
				if cifsErr != nil {
					result += fmt.Sprintf("\n⚠️ **Warning:** Volume created but CIFS share failed: %v\n", cifsErr)
				} else {
					result += fmt.Sprintf("\n📁 **CIFS Share:** %s\n", shareName)
					result += fmt.Sprintf("   Path: %s\n", sharePath)

					if comment, ok := cifsShareArg["comment"].(string); ok && comment != "" {
						result += fmt.Sprintf("   Comment: %s\n", comment)
					}

					if accessControl, ok := cifsShareArg["access_control"].([]interface{}); ok && len(accessControl) > 0 {
						result += "   Access Control:\n"
						for _, ace := range accessControl {
							aceMap := ace.(map[string]interface{})
							userOrGroup := aceMap["user_or_group"].(string)
							permission := aceMap["permission"].(string)
							result += fmt.Sprintf("   - %s: %s\n", userOrGroup, permission)
						}
					}

					result += "   📋 **Share Status:** Available for client access"
				}
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

			// Format output to match TypeScript
			result := fmt.Sprintf("✅ **Volume updated successfully!**\n\n"+
				"🎯 **Cluster:** %s\n"+
				"🆔 **Volume UUID:** %s\n\n"+
				"🔄 **Updated Properties:**\n", clusterName, volumeUUID)

			if sizeStr, ok := args["size"].(string); ok {
				result += fmt.Sprintf("   📊 Size: %s\n", sizeStr)
			}
			if comment, ok := args["comment"]; ok {
				commentStr := comment.(string)
				if commentStr == "" {
					result += "   💬 Comment: (cleared)\n"
				} else {
					result += fmt.Sprintf("   💬 Comment: %s\n", commentStr)
				}
			}
			if state, ok := args["state"].(string); ok {
				result += fmt.Sprintf("   📈 State: %s\n", state)
				if state == "offline" {
					result += "\n⚠️ **Warning:** The volume is now inaccessible. Required before deletion.\n"
				} else if state == "online" {
					result += "\n✅ **Info:** The volume is now accessible.\n"
				} else if state == "restricted" {
					result += "\n🔒 **Info:** The volume is in restricted mode (admin-only access).\n"
				}
			}

			result += "\n💡 **Note:** All specified properties have been updated."

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

			// Format output to match TypeScript
			result := fmt.Sprintf("✅ **Volume deleted successfully**\n\n"+
				"🎯 **Cluster:** %s\n"+
				"🆔 **Volume UUID:** %s\n"+
				"🗑️ **Status:** Permanently deleted\n\n"+
				"⚠️ **Note:** This action was irreversible. All data has been permanently destroyed.", clusterName, volumeUUID)

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
				"cluster_name":       map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
				"cluster_ip":         map[string]interface{}{"type": "string", "description": "IP address or FQDN (direct mode)"},
				"username":           map[string]interface{}{"type": "string", "description": "Username (direct mode)"},
				"password":           map[string]interface{}{"type": "string", "description": "Password (direct mode)"},
				"volume_uuid":        map[string]interface{}{"type": "string", "description": "UUID of the volume"},
				"export_policy_name": map[string]interface{}{"type": "string", "description": "Name of the export policy to apply"},
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
