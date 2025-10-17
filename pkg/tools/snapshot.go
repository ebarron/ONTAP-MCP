package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// Note: Parameter helpers now in params.go for shared use across all tools

func RegisterSnapshotPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
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
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

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

			// Build structured data array (matching TypeScript SnapshotPolicyListInfo[])
			dataArray := make([]map[string]interface{}, 0, len(policies))
			for _, policy := range policies {
				item := map[string]interface{}{
					"uuid":    policy.UUID,
					"name":    policy.Name,
					"enabled": policy.Enabled,
				}

				if policy.SVM != nil {
					item["svm"] = map[string]interface{}{
						"name": policy.SVM.Name,
						"uuid": policy.SVM.UUID,
					}
				}

				if policy.Comment != "" {
					item["comment"] = policy.Comment
				}

				// Count number of copy rules
				item["copies_count"] = len(policy.Copies)

				dataArray = append(dataArray, item)
			}

			// Build human-readable summary (matching TypeScript format)
			var summary string
			if len(policies) == 0 {
				summary = "No snapshot policies found"
			} else {
				summary = fmt.Sprintf("📸 **Snapshot Policies on cluster '%s'** (%d policies)\n\n", clusterName, len(policies))

				for _, policy := range policies {
					enabledIcon := "✅"
					if !policy.Enabled {
						enabledIcon = "⏸️"
					}
					summary += fmt.Sprintf("%s **%s** (UUID: %s)\n", enabledIcon, policy.Name, policy.UUID)

					if policy.SVM != nil {
						summary += fmt.Sprintf("   🏢 SVM: %s\n", policy.SVM.Name)
					}

					if policy.Comment != "" {
						summary += fmt.Sprintf("   📝 %s\n", policy.Comment)
					}

					summary += fmt.Sprintf("   📋 Copies: %d\n", len(policy.Copies))
					summary += "\n"
				}
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
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			policyName, err := getStringParam(args, "policy_name", true)
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
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			policyUUID, err := getStringParam(args, "policy_uuid", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
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

			policy, err := client.GetSnapshotPolicy(ctx, policyUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get snapshot policy: %v", err))},
					IsError: true,
				}, nil
			}

			// Build structured data (matching TypeScript SnapshotPolicyData)
			policyData := map[string]interface{}{
				"uuid":    policy.UUID,
				"name":    policy.Name,
				"enabled": policy.Enabled,
			}

			if policy.SVM != nil {
				policyData["svm"] = map[string]interface{}{
					"name": policy.SVM.Name,
					"uuid": policy.SVM.UUID,
				}
			}

			if policy.Comment != "" {
				policyData["comment"] = policy.Comment
			}

			// Add copies array
			copiesArray := make([]map[string]interface{}, 0, len(policy.Copies))
			for _, copy := range policy.Copies {
				copyItem := map[string]interface{}{
					"count": copy.Count,
				}

				if copy.Schedule != nil && copy.Schedule.Name != "" {
					copyItem["schedule"] = map[string]string{"name": copy.Schedule.Name}
				}

				if copy.Prefix != "" {
					copyItem["prefix"] = copy.Prefix
				}

				if copy.Retention != "" {
					copyItem["retention"] = copy.Retention
				}

				copiesArray = append(copiesArray, copyItem)
			}
			policyData["copies"] = copiesArray

			// Build human-readable summary (matching TypeScript format)
			enabledStatus := "✅ Enabled"
			if !policy.Enabled {
				enabledStatus = "⏸️ Disabled"
			}

			summary := fmt.Sprintf("📸 **Snapshot Policy: %s**\n\n", policy.Name)
			summary += fmt.Sprintf("🆔 UUID: %s\n", policy.UUID)
			summary += fmt.Sprintf("📊 Status: %s\n", enabledStatus)

			if policy.SVM != nil {
				summary += fmt.Sprintf("🏢 SVM: %s (%s)\n", policy.SVM.Name, policy.SVM.UUID)
			}

			if policy.Comment != "" {
				summary += fmt.Sprintf("📝 Comment: %s\n", policy.Comment)
			}

			if len(policy.Copies) > 0 {
				summary += fmt.Sprintf("\n📋 **Snapshot Copies Configuration (%d):**\n\n", len(policy.Copies))
				for i, copy := range policy.Copies {
					summary += fmt.Sprintf("**Copy %d:**\n", i+1)
					summary += fmt.Sprintf("  📊 Count: %d snapshots\n", copy.Count)

					if copy.Schedule != nil && copy.Schedule.Name != "" {
						summary += fmt.Sprintf("  ⏰ Schedule: %s\n", copy.Schedule.Name)
					}

					if copy.Prefix != "" {
						summary += fmt.Sprintf("  🏷️  Prefix: %s\n", copy.Prefix)
					}

					if copy.Retention != "" {
						summary += fmt.Sprintf("  ⏳ Retention: %s\n", copy.Retention)
					}

					summary += "\n"
				}
			} else {
				summary += "\n📋 **Snapshot Copies:** No copies configured\n"
			}

			// Return hybrid format as single JSON text (TypeScript-compatible)
			hybridResult := map[string]interface{}{
				"summary": summary,
				"data":    policyData,
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
			clusterName, err := getStringParam(args, "cluster_name", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
					IsError: true,
				}, nil
			}

			policyUUID, err := getStringParam(args, "policy_uuid", true)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(err.Error())},
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
