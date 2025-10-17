package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// RegisterClusterTools registers cluster management tools (4 tools)
func RegisterClusterTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_registered_clusters - List all registered clusters
	registry.Register(
		"list_registered_clusters",
		"List all registered ONTAP clusters in the cluster manager",
		map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			configs := clusterManager.ListClusterConfigs()
			
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
			clusters := clusterManager.ListClusters()
			if len(clusters) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No clusters registered."}},
				}, nil
			}

			result := "Cluster Information:\n\n"
			for _, name := range clusters {
				client, err := clusterManager.GetClient(name)
				if err != nil {
					result += fmt.Sprintf("- %s: ERROR - %v\n", name, err)
					continue
				}

				info, err := client.GetClusterInfo(ctx)
				if err != nil {
					result += fmt.Sprintf("- %s: ERROR - %v\n", name, err)
					continue
				}

				result += fmt.Sprintf("- %s: %s (%s) - %s\n", 
					name, info.Name, info.Version.Full, info.State)
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

			// Build structured data array
			dataArray := make([]map[string]interface{}, 0, len(svms))
			for _, svm := range svms {
				item := map[string]interface{}{
					"uuid":    svm.UUID,
					"name":    svm.Name,
					"state":   svm.State,
					"subtype": svm.Subtype,
				}
				dataArray = append(dataArray, item)
			}

			// Build human-readable summary
			summary := fmt.Sprintf("SVMs on cluster '%s': %d\n\n", clusterName, len(svms))
			for _, svm := range svms {
				summary += fmt.Sprintf("- %s (%s) - State: %s\n", svm.Name, svm.UUID, svm.State)
			}

			// Return hybrid format (Phase 2, Step 2)
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
}
