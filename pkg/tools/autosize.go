package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterVolumeAutosizeTools(registry *Registry, clusterManager *ontap.ClusterManager) {
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

