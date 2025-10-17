package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterExportPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_export_policies - List NFS export policies
	registry.Register(
		"list_export_policies",
		"List all NFS export policies on an ONTAP cluster, optionally filtered by SVM or name pattern",
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

			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			if len(policies) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No export policies found"}},
				}, nil
			}

			result := fmt.Sprintf("Export Policies on cluster '%s' (%d):\n", clusterName, len(policies))
			for _, policy := range policies {
				result += fmt.Sprintf("- %s (ID: %d)", policy.Name, policy.ID)
				if policy.SVM != nil {
					result += fmt.Sprintf(" - SVM: %s", policy.SVM.Name)
				}
				if len(policy.Rules) > 0 {
					result += fmt.Sprintf(", Rules: %d", len(policy.Rules))
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. get_export_policy - Get export policy details with rules
	registry.Register(
		"get_export_policy",
		"Get detailed information about a specific export policy including all rules",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_id"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_id": map[string]interface{}{
					"type":        "number",
					"description": "ID of the export policy",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyID := int(args["policy_id"].(float64))

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policy, err := client.GetExportPolicy(ctx, policyID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Export Policy: %s (ID: %d)\n", policy.Name, policy.ID)
			if policy.SVM != nil {
				result += fmt.Sprintf("SVM: %s\n", policy.SVM.Name)
			}
			result += fmt.Sprintf("Rules: %d\n", len(policy.Rules))
			
			for _, rule := range policy.Rules {
				result += fmt.Sprintf("\nRule %d:\n", rule.Index)
				result += "  Clients: "
				for i, client := range rule.Clients {
					if i > 0 {
						result += ", "
					}
					result += client.Match
				}
				result += fmt.Sprintf("\n  Protocols: %v\n", rule.Protocols)
				result += fmt.Sprintf("  RO Rule: %v\n", rule.RoRule)
				result += fmt.Sprintf("  RW Rule: %v\n", rule.RwRule)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. create_export_policy - Create a new export policy
	registry.Register(
		"create_export_policy",
		"Create a new NFS export policy (rules must be added separately)",
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
					"description": "Name for the export policy",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy will be created",
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

			err = client.CreateExportPolicy(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully created export policy '%s' on SVM '%s'", policyName, svmName)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 4. delete_export_policy - Delete an export policy
	registry.Register(
		"delete_export_policy",
		"Delete an NFS export policy. Warning: Policy must not be in use by any volumes.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_id"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_id": map[string]interface{}{
					"type":        "number",
					"description": "ID of the export policy to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyID := int(args["policy_id"].(float64))

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteExportPolicy(ctx, policyID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted export policy ID %d", policyID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 5. add_export_rule - Add a rule to an export policy
	registry.Register(
		"add_export_rule",
		"Add a new export rule to an existing export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "policy_id", "clients"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"policy_id": map[string]interface{}{
					"type":        "number",
					"description": "ID of the export policy",
				},
				"clients": map[string]interface{}{
					"type":        "array",
					"description": "Client specifications (e.g., ['0.0.0.0/0', '10.0.0.0/8'])",
					"items": map[string]interface{}{
						"type": "string",
					},
				},
				"protocols": map[string]interface{}{
					"type":        "array",
					"description": "Allowed NFS protocols",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "nfs", "nfs3", "nfs4"},
					},
				},
				"ro_rule": map[string]interface{}{
					"type":        "array",
					"description": "Read-only access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "sys", "krb5"},
					},
				},
				"rw_rule": map[string]interface{}{
					"type":        "array",
					"description": "Read-write access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "sys", "krb5"},
					},
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			policyID := int(args["policy_id"].(float64))

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			rule := make(map[string]interface{})

			// Parse clients
			if clientsRaw, ok := args["clients"].([]interface{}); ok {
				clients := make([]map[string]string, len(clientsRaw))
				for i, c := range clientsRaw {
					clients[i] = map[string]string{"match": c.(string)}
				}
				rule["clients"] = clients
			}

			// Parse protocols
			if protocolsRaw, ok := args["protocols"].([]interface{}); ok {
				protocols := make([]string, len(protocolsRaw))
				for i, p := range protocolsRaw {
					protocols[i] = p.(string)
				}
				rule["protocols"] = protocols
			}

			// Parse ro_rule
			if roRaw, ok := args["ro_rule"].([]interface{}); ok {
				ro := make([]string, len(roRaw))
				for i, r := range roRaw {
					ro[i] = r.(string)
				}
				rule["ro_rule"] = ro
			}

			// Parse rw_rule
			if rwRaw, ok := args["rw_rule"].([]interface{}); ok {
				rw := make([]string, len(rwRaw))
				for i, r := range rwRaw {
					rw[i] = r.(string)
				}
				rule["rw_rule"] = rw
			}

			err = client.AddExportRule(ctx, policyID, rule)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to add export rule: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully added export rule to policy ID %d", policyID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Note: delete_export_rule and update_export_rule require policy ID resolution
	// which is better handled at the cluster_ prefix level for now
}

