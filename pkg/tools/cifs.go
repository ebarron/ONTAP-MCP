package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// Note: Parameter helpers now in params.go for shared use across all tools

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
				"volume_name": map[string]interface{}{
					"type":        "string",
					"description": "Filter by volume name",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			svmName := ""
			shareName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}
		if share, ok := args["share_name_pattern"].(string); ok {
			shareName = share
		}

		// Get session-specific cluster manager from context
		activeClusterManager := getActiveClusterManager(ctx, clusterManager)
		client, err := activeClusterManager.GetClient(clusterName)
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

			// Build structured data array (matching TypeScript CifsShareListInfo[])
			data := make([]map[string]interface{}, 0, len(shares))
			for _, share := range shares {
				shareData := map[string]interface{}{
					"name": share.Name,
					"path": share.Path,
				}
				if share.SVM != nil {
					shareData["svm_name"] = share.SVM.Name
					shareData["svm_uuid"] = share.SVM.UUID
				}
				if share.Volume != nil {
					shareData["volume_name"] = share.Volume.Name
					shareData["volume_uuid"] = share.Volume.UUID
				}
				if share.Comment != "" {
					shareData["comment"] = share.Comment
				}
				if share.Properties != nil {
					shareData["properties"] = map[string]interface{}{
						"encryption":               share.Properties.Encryption,
						"oplocks":                  share.Properties.Oplocks,
						"offline_files":            share.Properties.OfflineFiles,
						"access_based_enumeration": share.Properties.AccessBasedEnumeration,
					}
				}
				data = append(data, shareData)
			}

			// Build human-readable summary (matching TypeScript format)
			var summary string
			if len(shares) == 0 {
				summary = fmt.Sprintf("No CIFS shares found in cluster '%s' matching the criteria.", clusterName)
			} else {
				summary = fmt.Sprintf("Found %d CIFS share(s) in cluster '%s':\n\n", len(shares), clusterName)

				for _, share := range shares {
					summary += fmt.Sprintf("📁 **%s**\n", share.Name)
					summary += fmt.Sprintf("   Path: %s\n", share.Path)
					if share.SVM != nil {
						summary += fmt.Sprintf("   SVM: %s\n", share.SVM.Name)
					} else {
						summary += "   SVM: Unknown\n"
					}
					if share.Comment != "" {
						summary += fmt.Sprintf("   Comment: %s\n", share.Comment)
					}
					if share.Volume != nil {
						summary += fmt.Sprintf("   Volume: %s\n", share.Volume.Name)
					}
					summary += "\n"
				}
			}

			// Return hybrid format as single JSON text (TypeScript-compatible)
			hybridResult := map[string]interface{}{
				"summary": summary,
				"data":    data,
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
				"properties": map[string]interface{}{
					"type":        "object",
					"description": "Share properties",
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
							"description": "Offline files policy",
							"enum":        []string{"none", "manual", "documents", "programs"},
						},
						"oplocks": map[string]interface{}{
							"type":        "boolean",
							"description": "Oplocks",
						},
					},
				},
				"access_control": map[string]interface{}{
					"type":        "array",
					"description": "Access control entries",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"permission": map[string]interface{}{
								"type":        "string",
								"description": "Permission level",
								"enum":        []string{"no_access", "read", "change", "full_control"},
							},
							"user_or_group": map[string]interface{}{
								"type":        "string",
								"description": "User or group name",
							},
							"type": map[string]interface{}{
								"type":        "string",
								"description": "Type of user/group",
								"enum":        []string{"windows", "unix_user", "unix_group"},
							},
						},
						"required": []string{"permission", "user_or_group"},
					},
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			name, err := getStringParam(args, "name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			path, err := getStringParam(args, "path", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			svmName, err := getStringParam(args, "svm_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			// Get session-specific cluster manager from context
			activeClusterManager := getActiveClusterManager(ctx, clusterManager)
			client, err := activeClusterManager.GetClient(clusterName)
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
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			name, err := getStringParam(args, "name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			svmName, err := getStringParam(args, "svm_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			// Get session-specific cluster manager from context
			activeClusterManager := getActiveClusterManager(ctx, clusterManager)
			client, err := activeClusterManager.GetClient(clusterName)
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

	// ====================
	// Dual-Mode CIFS Tools (support both registry and direct credentials)
	// ====================

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("create_cifs_share", "Create a new CIFS share with specified access permissions and user groups", map[string]interface{}{
		"type": "object", "required": []string{"name", "path", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
			"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN of the ONTAP cluster (direct mode)"},
			"username":     map[string]interface{}{"type": "string", "description": "Username for authentication (direct mode)"},
			"password":     map[string]interface{}{"type": "string", "description": "Password for authentication (direct mode)"},
			"name":         map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"path":         map[string]interface{}{"type": "string", "description": "Volume path (typically /vol/volume_name)"},
			"svm_name":     map[string]interface{}{"type": "string", "description": "SVM name where share will be created"},
			"comment": map[string]interface{}{
				"type":        "string",
				"description": "Optional share comment",
			},
			"properties": map[string]interface{}{
				"type":        "object",
				"description": "Share properties",
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
						"description": "Offline files policy",
						"enum":        []string{"none", "manual", "documents", "programs"},
					},
					"oplocks": map[string]interface{}{
						"type":        "boolean",
						"description": "Oplocks",
					},
				},
			},
			"access_control": map[string]interface{}{
				"type":        "array",
				"description": "Access control entries",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"permission": map[string]interface{}{
							"type":        "string",
							"description": "Permission level",
							"enum":        []string{"no_access", "read", "change", "full_control"},
						},
						"user_or_group": map[string]interface{}{
							"type":        "string",
							"description": "User or group name",
						},
						"type": map[string]interface{}{
							"type":        "string",
							"description": "Type of user/group",
							"enum":        []string{"windows", "unix_user", "unix_group"},
						},
					},
					"required": []string{"permission", "user_or_group"},
				},
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(ctx, clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		name, err := getStringParam(args, "name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		path, err := getStringParam(args, "path", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		svmName, err := getStringParam(args, "svm_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		req := map[string]interface{}{"name": name, "path": path, "svm": map[string]string{"name": svmName}}
		if err := client.CreateCIFSShare(ctx, req); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Created CIFS share '%s' at path '%s'", name, path)}}}, nil
	})

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("delete_cifs_share", "Delete a CIFS share. WARNING: This will remove client access", map[string]interface{}{
		"type": "object", "required": []string{"name", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
			"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN of the ONTAP cluster (direct mode)"},
			"username":     map[string]interface{}{"type": "string", "description": "Username for authentication (direct mode)"},
			"password":     map[string]interface{}{"type": "string", "description": "Password for authentication (direct mode)"},
			"name":         map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"svm_name":     map[string]interface{}{"type": "string", "description": "SVM name"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(ctx, clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		svmName, err := getStringParam(args, "svm_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		name, err := getStringParam(args, "name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		if err := client.DeleteCIFSShare(ctx, svmName, name); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Deleted CIFS share '%s'", name)}}}, nil
	})

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("get_cifs_share", "Get detailed information about a specific CIFS share", map[string]interface{}{
		"type": "object", "required": []string{"name", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
			"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN of the ONTAP cluster (direct mode)"},
			"username":     map[string]interface{}{"type": "string", "description": "Username for authentication (direct mode)"},
			"password":     map[string]interface{}{"type": "string", "description": "Password for authentication (direct mode)"},
			"name":         map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"svm_name":     map[string]interface{}{"type": "string", "description": "SVM name"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(ctx, clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		svmName, err := getStringParam(args, "svm_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		name, err := getStringParam(args, "name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		// GetCIFSShare now accepts SVM name directly (matches TypeScript)
		share, err := client.GetCIFSShare(ctx, svmName, name)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}

		// Build structured data object matching TypeScript CifsShareData
		data := map[string]interface{}{
			"name": share.Name,
			"path": share.Path,
		}
		if share.SVM != nil {
			data["svm_name"] = share.SVM.Name
			data["svm_uuid"] = share.SVM.UUID
		}
		if share.Comment != "" {
			data["comment"] = share.Comment
		}
		if share.Volume != nil {
			data["volume_name"] = share.Volume.Name
			data["volume_uuid"] = share.Volume.UUID
		}
		if share.ACLs != nil && len(share.ACLs) > 0 {
			acls := make([]map[string]interface{}, 0, len(share.ACLs))
			for _, ace := range share.ACLs {
				aclData := map[string]interface{}{
					"user_or_group": ace.UserOrGroup,
					"permission":    ace.Permission,
				}
				if ace.Type != "" {
					aclData["type"] = ace.Type
				}
				acls = append(acls, aclData)
			}
			data["access_control"] = acls
		}
		if share.Properties != nil {
			data["properties"] = map[string]interface{}{
				"oplocks":                  share.Properties.Oplocks,
				"encryption":               share.Properties.Encryption,
				"access_based_enumeration": share.Properties.AccessBasedEnumeration,
				"offline_files":            share.Properties.OfflineFiles,
			}
		}

		// Build human-readable summary (matching TypeScript format)
		summary := fmt.Sprintf("📁 **CIFS Share: %s**\n\n", share.Name)
		summary += "**Basic Information:**\n"
		summary += fmt.Sprintf("- Path: %s\n", share.Path)
		if share.SVM != nil {
			summary += fmt.Sprintf("- SVM: %s\n", share.SVM.Name)
		}
		if share.Comment != "" {
			summary += fmt.Sprintf("- Comment: %s\n", share.Comment)
		}
		if share.Volume != nil {
			summary += fmt.Sprintf("- Volume: %s (%s)\n", share.Volume.Name, share.Volume.UUID)
		}

		if share.Properties != nil {
			summary += "\n**Share Properties:**\n"
			summary += fmt.Sprintf("- oplocks: %v\n", share.Properties.Oplocks)
			summary += fmt.Sprintf("- encryption: %v\n", share.Properties.Encryption)
			summary += fmt.Sprintf("- access_based_enumeration: %v\n", share.Properties.AccessBasedEnumeration)
			if share.Properties.OfflineFiles != "" {
				summary += fmt.Sprintf("- offline_files: %s\n", share.Properties.OfflineFiles)
			}
		}

		if share.ACLs != nil && len(share.ACLs) > 0 {
			summary += "\n**Access Control:**\n"
			for _, ace := range share.ACLs {
				summary += fmt.Sprintf("- %s: %s", ace.UserOrGroup, ace.Permission)
				if ace.Type != "" {
					summary += fmt.Sprintf(" (%s)", ace.Type)
				}
				summary += "\n"
			}
		}

		// Return hybrid format as single JSON text (TypeScript-compatible)
		hybridResult := map[string]interface{}{
			"summary": summary,
			"data":    data,
		}

		hybridJSON, err := json.Marshal(hybridResult)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed to serialize hybrid result: %v", err))}, IsError: true}, nil
		}

		return &CallToolResult{
			Content: []Content{{Type: "text", Text: string(hybridJSON)}},
		}, nil
	})

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("list_cifs_shares", "List all CIFS shares in the cluster or filtered by SVM", map[string]interface{}{
		"type": "object", "required": []string{},
		"properties": map[string]interface{}{
			"cluster_name":       map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
			"cluster_ip":         map[string]interface{}{"type": "string", "description": "IP address or FQDN of the ONTAP cluster (direct mode)"},
			"username":           map[string]interface{}{"type": "string", "description": "Username for authentication (direct mode)"},
			"password":           map[string]interface{}{"type": "string", "description": "Password for authentication (direct mode)"},
			"svm_name":           map[string]interface{}{"type": "string", "description": "Filter by SVM name"},
			"share_name_pattern": map[string]interface{}{"type": "string", "description": "Filter by share name pattern"},
			"volume_name":        map[string]interface{}{"type": "string", "description": "Filter by volume name"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(ctx, clusterManager, args)
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

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("update_cifs_share", "Update an existing CIFS share's properties and access control", map[string]interface{}{
		"type": "object", "required": []string{"name", "svm_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string", "description": "Name of the registered cluster (registry mode)"},
			"cluster_ip":   map[string]interface{}{"type": "string", "description": "IP address or FQDN of the ONTAP cluster (direct mode)"},
			"username":     map[string]interface{}{"type": "string", "description": "Username for authentication (direct mode)"},
			"password":     map[string]interface{}{"type": "string", "description": "Password for authentication (direct mode)"},
			"name":         map[string]interface{}{"type": "string", "description": "CIFS share name"},
			"svm_name":     map[string]interface{}{"type": "string", "description": "SVM name where share exists"},
			"comment":      map[string]interface{}{"type": "string", "description": "Updated share comment"},
			"properties": map[string]interface{}{
				"type":        "object",
				"description": "Updated share properties",
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
						"description": "Offline files policy",
						"enum":        []string{"none", "manual", "documents", "programs"},
					},
					"oplocks": map[string]interface{}{
						"type":        "boolean",
						"description": "Oplocks",
					},
				},
			},
			"access_control": map[string]interface{}{
				"type":        "array",
				"description": "Updated access control entries",
				"items": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"permission": map[string]interface{}{
							"type":        "string",
							"description": "Permission level",
							"enum":        []string{"no_access", "read", "change", "full_control"},
						},
						"user_or_group": map[string]interface{}{
							"type":        "string",
							"description": "User or group name",
						},
						"type": map[string]interface{}{
							"type":        "string",
							"description": "Type of user/group",
							"enum":        []string{"windows", "unix_user", "unix_group"},
						},
					},
					"required": []string{"permission", "user_or_group"},
				},
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(ctx, clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		svmName, err := getStringParam(args, "svm_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		name, err := getStringParam(args, "name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		updates := make(map[string]interface{})
		if comment, ok := args["comment"].(string); ok {
			updates["comment"] = comment
		}

		if err := client.UpdateCIFSShare(ctx, svmName, name, updates); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Updated CIFS share '%s'", name)}}}, nil
	})
}
