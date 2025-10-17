package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterQoSPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
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

