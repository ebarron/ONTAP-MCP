package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// Note: Parameter helpers now in params.go for shared use across all tools

func RegisterVolumeAutosizeTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_get_volume_autosize_status - Get autosize configuration
	registry.Register(
		"cluster_get_volume_autosize_status",
		"Get the current autosize configuration and status for a volume on a registered cluster, including current size, limits, and space usage.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"volume_name": map[string]interface{}{
					"type":        "string",
					"description": "Volume name (alternative to volume_uuid)",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name (required if using volume_name)",
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

			// Resolve volume UUID if name provided
			volumeUUID := ""
			if uuid, ok := args["volume_uuid"].(string); ok {
				volumeUUID = uuid
			} else if volName, ok := args["volume_name"].(string); ok {
				svmName, ok := args["svm_name"].(string)
				if !ok {
					return &CallToolResult{
						Content: []Content{ErrorContent("svm_name is required when using volume_name")},
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

				for _, vol := range volumes {
					if vol.Name == volName {
						volumeUUID = vol.UUID
						break
					}
				}

				if volumeUUID == "" {
					return &CallToolResult{
						Content: []Content{ErrorContent(fmt.Sprintf("Volume '%s' not found in SVM '%s'", volName, svmName))},
						IsError: true,
					}, nil
				}
			} else {
				return &CallToolResult{
					Content: []Content{ErrorContent("Either volume_uuid or volume_name must be provided")},
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

			summary := "Volume Autosize Configuration:\n\n"
			summary += fmt.Sprintf("Mode: %s\n", autosize.Mode)
			if autosize.Maximum > 0 {
				summary += fmt.Sprintf("Maximum: %s\n", formatBytes(autosize.Maximum))
			}
			// Only show minimum if actually set (for grow_shrink mode)
			if autosize.Mode == "grow_shrink" && autosize.Minimum > 0 {
				summary += fmt.Sprintf("Minimum: %s\n", formatBytes(autosize.Minimum))
			}
			if autosize.GrowThreshold > 0 {
				summary += fmt.Sprintf("Grow Threshold: %d%%\n", autosize.GrowThreshold)
			}
			// Only show shrink threshold for grow_shrink mode
			if autosize.Mode == "grow_shrink" && autosize.ShrinkThreshold > 0 {
				summary += fmt.Sprintf("Shrink Threshold: %d%%\n", autosize.ShrinkThreshold)
			}

			// Return hybrid format as single JSON text (TypeScript-compatible)
			// Format: {summary: "human text", data: {...json object...}}
			hybridResult := map[string]interface{}{
				"summary": summary,
				"data":    autosize,
			}

			hybridJSON, err := json.Marshal(hybridResult)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to serialize hybrid result: %v", err))},
					IsError: true,
				}, nil
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: string(hybridJSON)}},
			}, nil
		},
	)

	// 2. cluster_enable_volume_autosize - Configure volume autosize
	registry.Register(
		"cluster_enable_volume_autosize",
		"Enable or configure volume autosize on a registered cluster. Autosize automatically adjusts volume size based on utilization. Use 'grow' mode for automatic growth only, or 'grow_shrink' for both growth and shrinkage.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "mode"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"volume_name": map[string]interface{}{
					"type":        "string",
					"description": "Volume name (alternative to volume_uuid)",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name (required if using volume_name)",
				},
				"mode": map[string]interface{}{
					"type":        "string",
					"description": "Autosize mode: 'off' to disable, 'grow' for growth only, 'grow_shrink' for both",
					"enum":        []string{"off", "grow", "grow_shrink"},
				},
				"maximum_size": map[string]interface{}{
					"type":        "string",
					"description": "Maximum size (e.g., '1TB', '500GB') - required when mode is not 'off'",
				},
				"minimum_size": map[string]interface{}{
					"type":        "string",
					"description": "Minimum size for grow_shrink mode (e.g., '100GB')",
				},
				"grow_threshold_percent": map[string]interface{}{
					"type":        "number",
					"description": "Percentage full to trigger growth (default: 85, range: 1-100)",
				},
				"shrink_threshold_percent": map[string]interface{}{
					"type":        "number",
					"description": "Percentage full to trigger shrink (default: 50, range: 1-100, only for grow_shrink mode)",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Invalid cluster_name: %v", err))},
					IsError: true,
				}, nil
			}

			mode, err := getStringParam(args, "mode", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Invalid mode: %v", err))},
					IsError: true,
				}, nil
			}

			// Validate mode parameter
			validModes := map[string]bool{"off": true, "grow": true, "grow_shrink": true}
			if !validModes[mode] {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Invalid mode '%s'. Must be one of: off, grow, grow_shrink", mode))},
					IsError: true,
				}, nil
			}

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			// Validate mode-specific requirements
			var maximumSize string
			if mode != "off" {
				maximumSize, err = getStringParam(args, "maximum_size", true)
				if err != nil {
					return &CallToolResult{
						Content: []Content{ErrorContent(fmt.Sprintf("maximum_size is required when mode != 'off': %v", err))},
						IsError: true,
					}, nil
				}
			}

			var minimumSize string
			if mode == "grow_shrink" {
				minimumSize, err = getStringParam(args, "minimum_size", true)
				if err != nil {
					return &CallToolResult{
						Content: []Content{ErrorContent(fmt.Sprintf("minimum_size is required when mode is 'grow_shrink': %v", err))},
						IsError: true,
					}, nil
				}
			}

			// Resolve volume UUID if name provided
			volumeUUID, _ := getStringParam(args, "volume_uuid", false)
			if volumeUUID == "" {
				volName, _ := getStringParam(args, "volume_name", false)
				if volName != "" {
					svmName, err := getStringParam(args, "svm_name", true)
					if err != nil {
						return &CallToolResult{
							Content: []Content{ErrorContent(fmt.Sprintf("svm_name is required when using volume_name: %v", err))},
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

					for _, vol := range volumes {
						if vol.Name == volName {
							volumeUUID = vol.UUID
							break
						}
					}

					if volumeUUID == "" {
						return &CallToolResult{
							Content: []Content{ErrorContent(fmt.Sprintf("Volume '%s' not found in SVM '%s'", volName, svmName))},
							IsError: true,
						}, nil
					}
				} else {
					return &CallToolResult{
						Content: []Content{ErrorContent("Either volume_uuid or volume_name must be provided")},
						IsError: true,
					}, nil
				}
			}

			config := map[string]interface{}{
				"mode": mode,
			}

			if maximumSize != "" {
				sizeBytes, err := parseSizeString(maximumSize)
				if err != nil {
					return &CallToolResult{
						Content: []Content{ErrorContent(fmt.Sprintf("Invalid maximum_size: %v", err))},
						IsError: true,
					}, nil
				}
				if sizeBytes > 0 {
					config["maximum"] = sizeBytes
				}
			}

			if minimumSize != "" {
				sizeBytes, err := parseSizeString(minimumSize)
				if err != nil {
					return &CallToolResult{
						Content: []Content{ErrorContent(fmt.Sprintf("Invalid minimum_size: %v", err))},
						IsError: true,
					}, nil
				}
				if sizeBytes > 0 {
					config["minimum"] = sizeBytes
				}
			}

			// Safe handling for optional numeric parameters
			if val, exists := args["grow_threshold_percent"]; exists && val != nil {
				if growThresh, ok := val.(float64); ok {
					config["grow_threshold"] = int(growThresh)
				}
			}

			if val, exists := args["shrink_threshold_percent"]; exists && val != nil {
				if shrinkThresh, ok := val.(float64); ok {
					config["shrink_threshold"] = int(shrinkThresh)
				}
			}

			err = client.EnableVolumeAutosize(ctx, volumeUUID, config)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to configure autosize: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("✅ Volume autosize %s for volume %s",
				map[string]string{
					"off":         "disabled",
					"grow":        "enabled with grow mode",
					"grow_shrink": "enabled with grow_shrink mode",
				}[mode],
				volumeUUID,
			)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}
