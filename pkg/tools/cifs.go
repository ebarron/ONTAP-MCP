package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterCIFSTools(registry *Registry, clusterManager *ontap.ClusterManager) {
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

