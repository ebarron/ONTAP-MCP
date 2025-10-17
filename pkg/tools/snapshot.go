package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

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

