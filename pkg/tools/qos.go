package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// Note: Parameter helpers now in params.go for shared use across all tools

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

			policies, err := client.ListQoSPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list QoS policies: %v", err))},
					IsError: true,
				}, nil
			}

			// Build structured data array (matching TypeScript QosPolicyListInfo[])
			dataArray := make([]map[string]interface{}, 0, len(policies))
			for _, policy := range policies {
				item := map[string]interface{}{
					"uuid":           policy.UUID,
					"name":           policy.Name,
					"type":           policy.PolicyClass, // Maps to "type" in TypeScript
					"is_shared":      policy.Shared,
					"workload_count": 0, // Would need to be fetched separately if available
				}

				if policy.SVM != nil {
					item["svm"] = map[string]interface{}{
						"name": policy.SVM.Name,
						"uuid": policy.SVM.UUID,
					}
				}

				// Add fixed policy limits
				if policy.Fixed != nil {
					fixedData := map[string]interface{}{}
					if policy.Fixed.MaxThroughputIOPS > 0 {
						fixedData["max_throughput"] = fmt.Sprintf("%d iops", policy.Fixed.MaxThroughputIOPS)
					}
					if policy.Fixed.MaxThroughputMBPS > 0 {
						fixedData["max_throughput"] = fmt.Sprintf("%d MB/s", policy.Fixed.MaxThroughputMBPS)
					}
					if policy.Fixed.MinThroughputIOPS > 0 {
						fixedData["min_throughput"] = fmt.Sprintf("%d iops", policy.Fixed.MinThroughputIOPS)
					}
					if len(fixedData) > 0 {
						item["fixed"] = fixedData
					}
				}

				// Add adaptive policy settings
				if policy.Adaptive != nil {
					adaptiveData := map[string]interface{}{}
					if policy.Adaptive.ExpectedIOPS > 0 {
						adaptiveData["expected_iops"] = fmt.Sprintf("%d iops/TB", policy.Adaptive.ExpectedIOPS)
					}
					if policy.Adaptive.PeakIOPS > 0 {
						adaptiveData["peak_iops"] = fmt.Sprintf("%d iops/TB", policy.Adaptive.PeakIOPS)
					}
					if policy.Adaptive.ExpectedIOPSAllocation != "" {
						adaptiveData["expected_iops_allocation"] = policy.Adaptive.ExpectedIOPSAllocation
					}
					if policy.Adaptive.PeakIOPSAllocation != "" {
						adaptiveData["peak_iops_allocation"] = policy.Adaptive.PeakIOPSAllocation
					}
					if len(adaptiveData) > 0 {
						item["adaptive"] = adaptiveData
					}
				}

				dataArray = append(dataArray, item)
			}

			// Build human-readable summary (matching TypeScript format)
			var summary string
			if len(policies) == 0 {
				summary = fmt.Sprintf("No QoS policies found on cluster %s", clusterName)
				if svmName != "" {
					summary += fmt.Sprintf(" in SVM %s", svmName)
				}
				summary += "."
			} else {
				summary = fmt.Sprintf("📊 **QoS Policies on %s** (%d policies):\n\n", clusterName, len(policies))

				for _, policy := range policies {
					summary += fmt.Sprintf("🎛️ **%s** (%s)\n", policy.Name, policy.UUID)
					if policy.SVM != nil {
						summary += fmt.Sprintf("   • SVM: %s\n", policy.SVM.Name)
					} else {
						summary += "   • SVM: Unknown\n"
					}
					summary += fmt.Sprintf("   • Type: %s\n", policy.PolicyClass)
					summary += fmt.Sprintf("   • Shared: %v\n", policy.Shared)
					summary += "   • Workloads: 0\n" // Would need separate query

					if policy.Fixed != nil {
						if policy.Fixed.MaxThroughputIOPS > 0 {
							summary += fmt.Sprintf("   • Max Throughput: %d iops\n", policy.Fixed.MaxThroughputIOPS)
						}
						if policy.Fixed.MaxThroughputMBPS > 0 {
							summary += fmt.Sprintf("   • Max Throughput: %d MB/s\n", policy.Fixed.MaxThroughputMBPS)
						}
						if policy.Fixed.MinThroughputIOPS > 0 {
							summary += fmt.Sprintf("   • Min Throughput: %d iops\n", policy.Fixed.MinThroughputIOPS)
						}
					}

					if policy.Adaptive != nil {
						if policy.Adaptive.ExpectedIOPS > 0 {
							summary += fmt.Sprintf("   • Expected IOPS: %d iops/TB\n", policy.Adaptive.ExpectedIOPS)
						}
						if policy.Adaptive.PeakIOPS > 0 {
							summary += fmt.Sprintf("   • Peak IOPS: %d iops/TB\n", policy.Adaptive.PeakIOPS)
						}
					}

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

			policy, err := client.GetQoSPolicy(ctx, policyUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get QoS policy: %v", err))},
					IsError: true,
				}, nil
			}

			// Build structured data (matching TypeScript QosPolicyData)
			// Determine policy type from policy class
			policyType := "fixed"
			if policy.Adaptive != nil {
				policyType = "adaptive"
			}
			
			data := map[string]interface{}{
				"uuid":      policy.UUID,
				"name":      policy.Name,
				"type":      policyType,
				"is_shared": policy.Shared,
			}

			if policy.SVM != nil {
				data["svm"] = map[string]interface{}{
					"name": policy.SVM.Name,
					"uuid": policy.SVM.UUID,
				}
			}

			// Add fixed policy data
			if policy.Fixed != nil {
				fixedData := map[string]interface{}{}
				if policy.Fixed.MaxThroughputIOPS > 0 {
					fixedData["max_throughput"] = fmt.Sprintf("%d iops", policy.Fixed.MaxThroughputIOPS)
				} else if policy.Fixed.MaxThroughputMBPS > 0 {
					fixedData["max_throughput"] = fmt.Sprintf("%d MB/s", policy.Fixed.MaxThroughputMBPS)
				}
				if policy.Fixed.MinThroughputIOPS > 0 {
					fixedData["min_throughput"] = fmt.Sprintf("%d iops", policy.Fixed.MinThroughputIOPS)
				}
				if len(fixedData) > 0 {
					data["fixed"] = fixedData
				}
			}

			// Add adaptive policy data
			if policy.Adaptive != nil {
				adaptiveData := map[string]interface{}{}
				if policy.Adaptive.ExpectedIOPS > 0 {
					adaptiveData["expected_iops"] = fmt.Sprintf("%d iops/TB", policy.Adaptive.ExpectedIOPS)
				}
				if policy.Adaptive.PeakIOPS > 0 {
					adaptiveData["peak_iops"] = fmt.Sprintf("%d iops/TB", policy.Adaptive.PeakIOPS)
				}
				if policy.Adaptive.ExpectedIOPSAllocation != "" {
					adaptiveData["expected_iops_allocation"] = policy.Adaptive.ExpectedIOPSAllocation
				}
				if policy.Adaptive.PeakIOPSAllocation != "" {
					adaptiveData["peak_iops_allocation"] = policy.Adaptive.PeakIOPSAllocation
				}
				if len(adaptiveData) > 0 {
					data["adaptive"] = adaptiveData
				}
			}

			// Build human-readable summary (matching TypeScript format)
			summary := "📊 **QoS Policy Details**\n\n"
			summary += fmt.Sprintf("🎛️ **%s** (%s)\n", policy.Name, policy.UUID)
			if policy.SVM != nil {
				summary += fmt.Sprintf("   • SVM: %s (%s)\n", policy.SVM.Name, policy.SVM.UUID)
			}
			summary += fmt.Sprintf("   • Type: %s\n", policyType)
			summary += fmt.Sprintf("   • Shared: %v\n", policy.Shared)
			summary += "   • Workloads Using Policy: 0\n\n"

			if policy.Fixed != nil && (policy.Fixed.MaxThroughputIOPS > 0 || policy.Fixed.MinThroughputIOPS > 0) {
				summary += "📈 **Fixed Limits:**\n"
				if policy.Fixed.MaxThroughputIOPS > 0 {
					summary += fmt.Sprintf("   • Maximum Throughput: %d iops\n", policy.Fixed.MaxThroughputIOPS)
				} else if policy.Fixed.MaxThroughputMBPS > 0 {
					summary += fmt.Sprintf("   • Maximum Throughput: %d MB/s\n", policy.Fixed.MaxThroughputMBPS)
				}
				if policy.Fixed.MinThroughputIOPS > 0 {
					summary += fmt.Sprintf("   • Minimum Throughput: %d iops\n", policy.Fixed.MinThroughputIOPS)
				}
			}

			if policy.Adaptive != nil && (policy.Adaptive.ExpectedIOPS > 0 || policy.Adaptive.PeakIOPS > 0) {
				summary += "📊 **Adaptive Scaling:**\n"
				if policy.Adaptive.ExpectedIOPS > 0 {
					summary += fmt.Sprintf("   • Expected IOPS: %d iops/TB\n", policy.Adaptive.ExpectedIOPS)
				}
				if policy.Adaptive.PeakIOPS > 0 {
					summary += fmt.Sprintf("   • Peak IOPS: %d iops/TB\n", policy.Adaptive.PeakIOPS)
				}
				if policy.Adaptive.ExpectedIOPSAllocation != "" {
					summary += fmt.Sprintf("   • Expected IOPS Allocation: %s\n", policy.Adaptive.ExpectedIOPSAllocation)
				}
				if policy.Adaptive.PeakIOPSAllocation != "" {
					summary += fmt.Sprintf("   • Peak IOPS Allocation: %s\n", policy.Adaptive.PeakIOPSAllocation)
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

			policyType, err := getStringParam(args, "policy_type", true)
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
