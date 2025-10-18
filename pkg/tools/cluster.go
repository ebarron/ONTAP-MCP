package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// Note: Parameter helpers now in params.go for shared use across all tools

// RegisterClusterTools registers cluster management tools (4 tools)
func RegisterClusterTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_registered_clusters - List all registered clusters
	registry.Register(
		"list_registered_clusters",
		"List all registered clusters in the cluster manager",
		map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			// Get session-specific cluster manager from context
			activeClusterManager := getActiveClusterManager(ctx, clusterManager)

			configs := activeClusterManager.ListClusterConfigs()

			if len(configs) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No clusters registered. Use 'add_cluster' to register clusters."}},
				}, nil
			}

			result := fmt.Sprintf("Registered clusters (%d):\n\n", len(configs))
			for _, cfg := range configs {
				desc := cfg.Description
				if desc == "" {
					desc = "No description"
				}
				result += fmt.Sprintf("- %s: %s (%s)\n", cfg.Name, cfg.ClusterIP, desc)
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
			// Get session-specific cluster manager from context
			activeClusterManager := getActiveClusterManager(ctx, clusterManager)

			clusters := activeClusterManager.ListClusters()
			if len(clusters) == 0 {
				summary := "No clusters registered."
				hybridResult := map[string]interface{}{
					"summary": summary,
					"data":    []map[string]interface{}{},
				}
				hybridJSON, _ := json.Marshal(hybridResult)
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: string(hybridJSON)}},
				}, nil
			}

			// Build structured data array (matching TypeScript)
			dataArray := make([]map[string]interface{}, 0, len(clusters))
			summary := "Cluster Information:\n\n"

			for _, name := range clusters {
				client, err := activeClusterManager.GetClient(name)
				if err != nil {
					summary += fmt.Sprintf("- %s: ERROR - %v\n", name, err)
					dataArray = append(dataArray, map[string]interface{}{
						"name":  name,
						"error": err.Error(),
					})
					continue
				}

				info, err := client.GetClusterInfo(ctx)
				if err != nil {
					summary += fmt.Sprintf("- %s: ERROR - %v\n", name, err)
					dataArray = append(dataArray, map[string]interface{}{
						"name":  name,
						"error": err.Error(),
					})
					continue
				}

				summary += fmt.Sprintf("- %s: %s (%s) - %s\n",
					name, info.Name, info.Version.Full, info.State)

				dataArray = append(dataArray, map[string]interface{}{
					"registered_name": name,
					"name":            info.Name,
					"version":         info.Version.Full,
					"state":           info.State,
					"uuid":            info.UUID,
				})
			}

			// Return hybrid format as single JSON text (TypeScript-compatible)
			hybridResult := map[string]interface{}{
				"summary": summary,
				"data":    dataArray,
			}

			hybridJSON, err := json.Marshal(hybridResult)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed to serialize hybrid result: %v", err))}, IsError: true}, nil
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: string(hybridJSON)}},
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
			// Get session-specific cluster manager from context
			activeClusterManager := getActiveClusterManager(ctx, clusterManager)

			name, err := getStringParam(args, "name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			clusterIP, err := getStringParam(args, "cluster_ip", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			username, err := getStringParam(args, "username", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			password, err := getStringParam(args, "password", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

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

			err = activeClusterManager.AddCluster(cfg)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to add cluster: %v", err))},
					IsError: true,
				}, nil
			}

			// Build result message matching TypeScript format
			result := fmt.Sprintf("Cluster '%s' added successfully:\n", name)
			result += fmt.Sprintf("IP: %s\n", clusterIP)
			if description != "" {
				result += fmt.Sprintf("Description: %s\n", description)
			} else {
				result += "Description: None\n"
			}
			result += fmt.Sprintf("Username: %s", username)

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
			// Get session-specific cluster manager from context
			activeClusterManager := getActiveClusterManager(ctx, clusterManager)

			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			client, err := activeClusterManager.GetClient(clusterName)
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

			// Build structured data array (matching TypeScript SvmListInfo[])
			dataArray := make([]map[string]interface{}, 0, len(svms))
			for _, svm := range svms {
				item := map[string]interface{}{
					"uuid":    svm.UUID,
					"name":    svm.Name,
					"state":   svm.State,
					"subtype": svm.Subtype,
				}
				// Note: aggregates field would be added here if available in SVM struct
				dataArray = append(dataArray, item)
			}

			// Build human-readable summary (matching TypeScript format)
			summary := fmt.Sprintf("SVMs on cluster '%s': %d\n\n", clusterName, len(svms))
			for _, svm := range svms {
				summary += fmt.Sprintf("- %s (%s) - State: %s\n", svm.Name, svm.UUID, svm.State)
			}

			// Return hybrid format as single JSON text (TypeScript-compatible)
			hybridResult := map[string]interface{}{
				"summary": summary,
				"data":    dataArray,
			}

			hybridJSON, err := json.Marshal(hybridResult)
			if err != nil {
				return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed to serialize hybrid result: %v", err))}, IsError: true}, nil
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: string(hybridJSON)}},
			}, nil
		},
	)
}
