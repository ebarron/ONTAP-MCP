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

	// 4. cluster_create_qos_policy - Create a QoS policy (fixed or adaptive)
	registry.Register(
		"cluster_create_qos_policy",
		"Create a QoS policy group (fixed or adaptive) on a registered cluster",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_name", "svm_name", "policy_type"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"minLength":   1,
					"maxLength":   127,
					"pattern":     "^[a-zA-Z0-9_-]+$",
					"description": "QoS policy name (1-127 chars, alphanumeric, underscore, hyphen)",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy will be created",
				},
				"policy_type": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"fixed", "adaptive"},
					"description": "Type of QoS policy: 'fixed' for absolute limits or 'adaptive' for scaling limits",
				},
				// Fixed policy parameters
				"max_throughput": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?(iops|IOPS|mb\\/s|MB\\/s|gb\\/s|GB\\/s)$",
					"description": "Maximum throughput (fixed policy only)",
				},
				"min_throughput": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?(iops|IOPS|mb\\/s|MB\\/s|gb\\/s|GB\\/s)$",
					"description": "Minimum guaranteed throughput (fixed policy only)",
				},
				"is_shared": map[string]interface{}{
					"type":        "boolean",
					"default":     true,
					"description": "Whether limits apply to all workloads combined (true) or per workload (false)",
				},
				// Adaptive policy parameters
				"expected_iops": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?iops\\/(tb|TB|gb|GB)$",
					"description": "Expected IOPS per TB/GB (adaptive policy only)",
				},
				"peak_iops": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?iops\\/(tb|TB|gb|GB)$",
					"description": "Peak IOPS per TB/GB (adaptive policy only)",
				},
				"expected_iops_allocation": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"used-space", "allocated-space"},
					"default":     "used-space",
					"description": "How expected IOPS are calculated (adaptive policy only)",
				},
				"peak_iops_allocation": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"used-space", "allocated-space"},
					"default":     "used-space",
					"description": "How peak IOPS are calculated (adaptive policy only)",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyName := args["policy_name"].(string)
			svmName := args["svm_name"].(string)
			policyType := args["policy_type"].(string)

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

			// Don't send is_shared unless it's explicitly set to false
			// ONTAP defaults to true and some versions reject the "shared" field
			if val, ok := args["is_shared"].(bool); ok && !val {
				req["shared"] = false
			}

			if policyType == "fixed" {
				// Fixed QoS policy
				fixed := make(map[string]interface{})

				// Parse max_throughput string (e.g., "1000iops" -> 1000)
				if maxThroughput, ok := args["max_throughput"].(string); ok {
					// Extract numeric value from string
					var value int64
					fmt.Sscanf(maxThroughput, "%d", &value)
					if value > 0 {
						fixed["max_throughput_iops"] = value
					}
				}

				// Parse min_throughput string (e.g., "100iops" -> 100)
				if minThroughput, ok := args["min_throughput"].(string); ok {
					var value int64
					fmt.Sscanf(minThroughput, "%d", &value)
					if value > 0 {
						fixed["min_throughput_iops"] = value
					}
				}

				if len(fixed) > 0 {
					req["fixed"] = fixed
				}
			} else if policyType == "adaptive" {
				// Adaptive QoS policy
				adaptive := make(map[string]interface{})

				if expectedIOPS, ok := args["expected_iops"].(string); ok {
					adaptive["expected_iops"] = expectedIOPS
				}

				if peakIOPS, ok := args["peak_iops"].(string); ok {
					adaptive["peak_iops"] = peakIOPS
				}

				if expectedAlloc, ok := args["expected_iops_allocation"].(string); ok {
					adaptive["expected_iops_allocation"] = expectedAlloc
				} else {
					adaptive["expected_iops_allocation"] = "used-space"
				}

				if peakAlloc, ok := args["peak_iops_allocation"].(string); ok {
					adaptive["peak_iops_allocation"] = peakAlloc
				} else {
					adaptive["peak_iops_allocation"] = "used-space"
				}

				if len(adaptive) > 0 {
					req["adaptive"] = adaptive
				}
			}

			err = client.CreateQoSPolicy(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("✅ **%s QoS Policy Created Successfully**\n\n", policyType)
			result += fmt.Sprintf("🎛️ **Policy Details:**\n")
			result += fmt.Sprintf("   • Name: %s\n", policyName)
			result += fmt.Sprintf("   • SVM: %s\n", svmName)
			result += fmt.Sprintf("   • Type: %s\n", policyType)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 5. cluster_update_qos_policy - Update a QoS policy
	registry.Register(
		"cluster_update_qos_policy",
		"Update an existing QoS policy group's name, limits, or allocation settings on a registered cluster",
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
					"pattern":     "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
					"description": "UUID of the QoS policy to update",
				},
				"new_name": map[string]interface{}{
					"type":        "string",
					"minLength":   1,
					"maxLength":   127,
					"pattern":     "^[a-zA-Z0-9_-]+$",
					"description": "New policy name",
				},
				"max_throughput": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?(iops|IOPS|mb\\/s|MB\\/s|gb\\/s|GB\\/s)$",
					"description": "New maximum throughput (fixed policies only)",
				},
				"min_throughput": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?(iops|IOPS|mb\\/s|MB\\/s|gb\\/s|GB\\/s)$",
					"description": "New minimum throughput (fixed policies only)",
				},
				"expected_iops": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?iops\\/(tb|TB|gb|GB)$",
					"description": "New expected IOPS (adaptive policies only)",
				},
				"peak_iops": map[string]interface{}{
					"type":        "string",
					"pattern":     "^\\d+(?:\\.\\d+)?iops\\/(tb|TB|gb|GB)$",
					"description": "New peak IOPS (adaptive policies only)",
				},
				"expected_iops_allocation": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"used-space", "allocated-space"},
					"description": "New expected IOPS allocation method (adaptive policies only)",
				},
				"peak_iops_allocation": map[string]interface{}{
					"type":        "string",
					"enum":        []string{"used-space", "allocated-space"},
					"description": "New peak IOPS allocation method (adaptive policies only)",
				},
				"is_shared": map[string]interface{}{
					"type":        "boolean",
					"description": "New shared setting",
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

			updates := make(map[string]interface{})

			// Handle name update
			if newName, ok := args["new_name"].(string); ok {
				updates["name"] = newName
			}

			// Handle is_shared update
			if isShared, ok := args["is_shared"].(bool); ok {
				updates["shared"] = isShared
			}

			// Handle fixed QoS updates
			if maxThroughput, ok := args["max_throughput"].(string); ok {
				if updates["fixed"] == nil {
					updates["fixed"] = make(map[string]interface{})
				}
				var value int64
				fmt.Sscanf(maxThroughput, "%d", &value)
				if value > 0 {
					updates["fixed"].(map[string]interface{})["max_throughput_iops"] = value
				}
			}

			if minThroughput, ok := args["min_throughput"].(string); ok {
				if updates["fixed"] == nil {
					updates["fixed"] = make(map[string]interface{})
				}
				var value int64
				fmt.Sscanf(minThroughput, "%d", &value)
				if value > 0 {
					updates["fixed"].(map[string]interface{})["min_throughput_iops"] = value
				}
			}

			// Handle adaptive QoS updates
			if expectedIOPS, ok := args["expected_iops"].(string); ok {
				if updates["adaptive"] == nil {
					updates["adaptive"] = make(map[string]interface{})
				}
				updates["adaptive"].(map[string]interface{})["expected_iops"] = expectedIOPS
			}

			if peakIOPS, ok := args["peak_iops"].(string); ok {
				if updates["adaptive"] == nil {
					updates["adaptive"] = make(map[string]interface{})
				}
				updates["adaptive"].(map[string]interface{})["peak_iops"] = peakIOPS
			}

			if expectedAlloc, ok := args["expected_iops_allocation"].(string); ok {
				if updates["adaptive"] == nil {
					updates["adaptive"] = make(map[string]interface{})
				}
				updates["adaptive"].(map[string]interface{})["expected_iops_allocation"] = expectedAlloc
			}

			if peakAlloc, ok := args["peak_iops_allocation"].(string); ok {
				if updates["adaptive"] == nil {
					updates["adaptive"] = make(map[string]interface{})
				}
				updates["adaptive"].(map[string]interface{})["peak_iops_allocation"] = peakAlloc
			}

			if len(updates) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No updates specified"}},
				}, nil
			}

			err = client.UpdateQoSPolicy(ctx, policyUUID, updates)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to update QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully updated QoS policy %s", policyUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}
