package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterExportPolicyTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. list_export_policies - List NFS export policies
	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"list_export_policies",
		"List all NFS export policies on an ONTAP cluster, optionally filtered by SVM or name pattern",
		map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "Filter by SVM name",
				},
				"policy_name_pattern": map[string]interface{}{
					"type":        "string",
					"description": "Filter by policy name pattern",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			// Build structured data array (matching TypeScript ExportPolicyListInfo[])
			dataArray := make([]map[string]interface{}, 0, len(policies))
			for _, policy := range policies {
				item := map[string]interface{}{
					"id":   policy.ID,
					"name": policy.Name,
				}

				if policy.Comment != "" {
					item["comment"] = policy.Comment
				}

				// TypeScript format: svm_name and svm_uuid as separate fields (not nested svm object)
				if policy.SVM != nil {
					item["svm_name"] = policy.SVM.Name
					item["svm_uuid"] = policy.SVM.UUID
				}

				// Add rule_count field (TypeScript format)
				item["rule_count"] = len(policy.Rules)

				// Add rules preview (first 3 rules)
				if len(policy.Rules) > 0 {
					preview := make([]map[string]interface{}, 0)
					for i, rule := range policy.Rules {
						if i >= 3 {
							break
						}
						// TypeScript format: clients as comma-separated string, not array
						clients := make([]string, 0, len(rule.Clients))
						for _, c := range rule.Clients {
							clients = append(clients, c.Match)
						}
						preview = append(preview, map[string]interface{}{
							"index":   rule.Index,
							"clients": strings.Join(clients, ", "),
						})
					}
					item["rules_preview"] = preview
				}

				dataArray = append(dataArray, item)
			}

			// Build human-readable summary (matching TypeScript format)
			var summary string
			if len(policies) == 0 {
				summary = "No export policies found matching the specified criteria."
			} else {
				summary = fmt.Sprintf("Found %d export policies:\n\n", len(policies))

				for _, policy := range policies {
					summary += fmt.Sprintf("🔐 **%s** (ID: %d)\n", policy.Name, policy.ID)
					if policy.SVM != nil {
						summary += fmt.Sprintf("   🏢 SVM: %s\n", policy.SVM.Name)
					}
					if policy.Comment != "" {
						summary += fmt.Sprintf("   📝 Description: %s\n", policy.Comment)
					}

					if len(policy.Rules) > 0 {
						summary += fmt.Sprintf("   📏 Rules: %d\n", len(policy.Rules))
						for i, rule := range policy.Rules {
							if i >= 3 {
								break
							}
							clients := make([]string, 0, len(rule.Clients))
							for _, c := range rule.Clients {
								clients = append(clients, c.Match)
							}
							summary += fmt.Sprintf("     • Rule %d: %s\n", rule.Index, strings.Join(clients, ", "))
						}
						if len(policy.Rules) > 3 {
							summary += fmt.Sprintf("     • ... and %d more rules\n", len(policy.Rules)-3)
						}
					} else {
						summary += "   📏 Rules: None\n"
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

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"get_export_policy",
		"Get detailed information about a specific export policy including all rules",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"policy_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name or ID of the export policy",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name to search within",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policyName := args["policy_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			// First, list policies to find the policy by name and get its ID
			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			// Find policy by name
			var policy *ontap.ExportPolicy
			for i := range policies {
				if policies[i].Name == policyName {
					policy = &policies[i]
					break
				}
			}

			if policy == nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Export policy '%s' not found", policyName))},
					IsError: true,
				}, nil
			}

			// Build structured data
			dataArray := make([]map[string]interface{}, 0, len(policy.Rules))
			for _, rule := range policy.Rules {
				clients := make([]map[string]string, len(rule.Clients))
				for i, c := range rule.Clients {
					clients[i] = map[string]string{"match": c.Match}
				}

				ruleData := map[string]interface{}{
					"index":     rule.Index,
					"clients":   clients,
					"ro_rule":   rule.RoRule,
					"rw_rule":   rule.RwRule,
					"superuser": rule.Superuser,
					"protocols": rule.Protocols,
				}
				ruleData["allow_suid"] = rule.AllowSuid
				ruleData["allow_device_creation"] = rule.AllowDeviceCreation
				if rule.AnonymousUser != "" {
					ruleData["anonymous_user"] = rule.AnonymousUser
				}
				dataArray = append(dataArray, ruleData)
			}

			policyData := map[string]interface{}{
				"id":    policy.ID,
				"name":  policy.Name,
				"rules": dataArray,
			}

			if policy.Comment != "" {
				policyData["comment"] = policy.Comment
			}

			if policy.SVM != nil {
				policyData["svm"] = map[string]interface{}{
					"name": policy.SVM.Name,
					"uuid": policy.SVM.UUID,
				}
			}

			// Build human-readable summary (matching TypeScript format)
			summary := fmt.Sprintf("🔐 **Export Policy: %s**\n\n", policy.Name)
			summary += fmt.Sprintf("🆔 ID: %d\n", policy.ID)

			if policy.SVM != nil {
				summary += fmt.Sprintf("🏢 SVM: %s (%s)\n", policy.SVM.Name, policy.SVM.UUID)
			}

			if policy.Comment != "" {
				summary += fmt.Sprintf("📝 Description: %s\n", policy.Comment)
			}

			if len(policy.Rules) > 0 {
				summary += fmt.Sprintf("\n📏 **Export Rules (%d):**\n\n", len(policy.Rules))
				for _, rule := range policy.Rules {
					summary += fmt.Sprintf("**Rule %d:**\n", rule.Index)

					// Clients
					summary += "  👥 Clients: "
					clientStrs := make([]string, len(rule.Clients))
					for i, c := range rule.Clients {
						clientStrs[i] = c.Match
					}
					summary += fmt.Sprintf("%s\n", strings.Join(clientStrs, ", "))

					// Protocols
					summary += fmt.Sprintf("  🔌 Protocols: %v\n", rule.Protocols)

					// Access rules
					summary += fmt.Sprintf("  📖 Read-Only: %v\n", rule.RoRule)
					summary += fmt.Sprintf("  📝 Read-Write: %v\n", rule.RwRule)
					summary += fmt.Sprintf("  👑 Superuser: %v\n", rule.Superuser)
					summary += fmt.Sprintf("  🔓 Allow SUID: %v\n", rule.AllowSuid)
					summary += fmt.Sprintf("  � Allow Device Creation: %v\n", rule.AllowDeviceCreation)

					// Optional fields
					if rule.AnonymousUser != "" {
						summary += fmt.Sprintf("  � Anonymous User: %s\n", rule.AnonymousUser)
					}
					summary += "\n"
				}
			} else {
				summary += "\n📏 **Export Rules:** None configured\n"
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

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"create_export_policy",
		"Create a new NFS export policy (rules must be added separately)",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"policy_name", "svm_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name for the export policy",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy will be created",
				},
				"comment": map[string]interface{}{
					"type":        "string",
					"description": "Optional description for the policy",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policyName := args["policy_name"].(string)
			svmName := args["svm_name"].(string)

			req := map[string]interface{}{
				"name": policyName,
				"svm":  map[string]string{"name": svmName},
			}

			if comment, ok := args["comment"].(string); ok && comment != "" {
				req["comment"] = comment
			}

			err = client.CreateExportPolicy(ctx, req)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to create export policy: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("✅ **Export policy '%s' created successfully!**\n\n", policyName)
			result += fmt.Sprintf("📋 Name: %s\n", policyName)
			result += fmt.Sprintf("🏢 SVM: %s\n", svmName)
			if comment, ok := args["comment"].(string); ok && comment != "" {
				result += fmt.Sprintf("📝 Description: %s\n", comment)
			}

			result += "\n💡 **Next Steps:**\n"
			result += "   • Add export rules using: add_export_rule\n"
			result += "   • Apply to volumes using: configure_volume_nfs_access\n"
			result += "   • View policy details using: get_export_policy\n"

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"delete_export_policy",
		"Delete an NFS export policy. Warning: Policy must not be in use by any volumes.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"policy_name"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name or ID of the export policy to delete",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy exists",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policyName := args["policy_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			// First, list policies to find the policy by name and get its ID
			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			// Find the policy by name
			var policyID int
			found := false
			for _, policy := range policies {
				if policy.Name == policyName {
					policyID = policy.ID
					found = true
					break
				}
			}

			if !found {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Export policy '%s' not found", policyName))},
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

			result := fmt.Sprintf("✅ **Export policy '%s' deleted successfully!**\n\n", policyName)
			result += "⚠️ **Important:** Make sure no volumes were using this policy, or they will revert to the default export policy."

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"add_export_rule",
		"Add a new export rule to an existing export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"policy_name", "clients"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name or ID of the export policy",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy exists",
				},
				"clients": map[string]interface{}{
					"type":        "array",
					"description": "Client specifications",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"match": map[string]interface{}{
								"type":        "string",
								"description": "Client specification",
							},
						},
						"required": []string{"match"},
					},
				},
				"protocols": map[string]interface{}{
					"type":        "array",
					"description": "Allowed NFS protocols",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "nfs", "nfs3", "nfs4", "nfs41"},
					},
				},
				"ro_rule": map[string]interface{}{
					"type":        "array",
					"description": "Read-only access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"},
					},
				},
				"rw_rule": map[string]interface{}{
					"type":        "array",
					"description": "Read-write access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"},
					},
				},
				"superuser": map[string]interface{}{
					"type":        "array",
					"description": "Superuser access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"},
					},
				},
				"index": map[string]interface{}{
					"type":        "number",
					"description": "Rule index",
				},
				"allow_device_creation": map[string]interface{}{
					"type":        "boolean",
					"description": "Allow device creation",
				},
				"allow_suid": map[string]interface{}{
					"type":        "boolean",
					"description": "Allow set UID",
				},
				"anonymous_user": map[string]interface{}{
					"type":        "string",
					"description": "Anonymous user mapping",
				},
				"comment": map[string]interface{}{
					"type":        "string",
					"description": "Rule comment",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policyName := args["policy_name"].(string)
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			// First, resolve policy name to ID
			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			var policyID int
			found := false
			for _, policy := range policies {
				if policy.Name == policyName {
					policyID = policy.ID
					found = true
					break
				}
			}

			if !found {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Export policy '%s' not found", policyName))},
					IsError: true,
				}, nil
			}

			rule := make(map[string]interface{})

			// Parse clients
			if clientsRaw, ok := args["clients"].([]interface{}); ok {
				clients := make([]map[string]string, len(clientsRaw))
				for i, c := range clientsRaw {
					if clientMap, ok := c.(map[string]interface{}); ok {
						clients[i] = map[string]string{"match": clientMap["match"].(string)}
					}
				}
				rule["clients"] = clients
			}

			// Parse optional arrays
			if protocolsRaw, ok := args["protocols"].([]interface{}); ok {
				protocols := make([]string, len(protocolsRaw))
				for i, p := range protocolsRaw {
					protocols[i] = p.(string)
				}
				rule["protocols"] = protocols
			}

			if roRaw, ok := args["ro_rule"].([]interface{}); ok {
				ro := make([]string, len(roRaw))
				for i, r := range roRaw {
					ro[i] = r.(string)
				}
				rule["ro_rule"] = ro
			}

			if rwRaw, ok := args["rw_rule"].([]interface{}); ok {
				rw := make([]string, len(rwRaw))
				for i, r := range rwRaw {
					rw[i] = r.(string)
				}
				rule["rw_rule"] = rw
			}

			if superuserRaw, ok := args["superuser"].([]interface{}); ok {
				superuser := make([]string, len(superuserRaw))
				for i, s := range superuserRaw {
					superuser[i] = s.(string)
				}
				rule["superuser"] = superuser
			}

			// Optional fields
			if index, ok := args["index"].(float64); ok {
				rule["index"] = int(index)
			}

			if allowDevice, ok := args["allow_device_creation"].(bool); ok {
				rule["allow_device_creation"] = allowDevice
			}

			if allowSuid, ok := args["allow_suid"].(bool); ok {
				rule["allow_suid"] = allowSuid
			}

			if anonUser, ok := args["anonymous_user"].(string); ok && anonUser != "" {
				rule["anonymous_user"] = anonUser
			}

			if comment, ok := args["comment"].(string); ok && comment != "" {
				rule["comment"] = comment
			}

			err = client.AddExportRule(ctx, policyID, rule)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to add export rule: %v", err))},
					IsError: true,
				}, nil
			}

			// Extract client matches for display
			clientMatches := []string{}
			if clientsRaw, ok := args["clients"].([]interface{}); ok {
				for _, c := range clientsRaw {
					if clientMap, ok := c.(map[string]interface{}); ok {
						if match, ok := clientMap["match"].(string); ok {
							clientMatches = append(clientMatches, match)
						}
					}
				}
			}

			result := "✅ **Export rule added successfully!**\n\n"
			result += fmt.Sprintf("🔐 **Policy:** %s\n", policyName)
			if len(clientMatches) > 0 {
				result += fmt.Sprintf("👥 **Clients:** %s\n", clientMatches)
			}
			if protocols, ok := args["protocols"].([]interface{}); ok {
				protoStrs := make([]string, len(protocols))
				for i, p := range protocols {
					protoStrs[i] = p.(string)
				}
				result += fmt.Sprintf("🔌 **Protocols:** %s\n", protoStrs)
			}
			if ro, ok := args["ro_rule"].([]interface{}); ok {
				roStrs := make([]string, len(ro))
				for i, r := range ro {
					roStrs[i] = r.(string)
				}
				result += fmt.Sprintf("📖 **Read-Only:** %s\n", roStrs)
			}
			if rw, ok := args["rw_rule"].([]interface{}); ok {
				rwStrs := make([]string, len(rw))
				for i, r := range rw {
					rwStrs[i] = r.(string)
				}
				result += fmt.Sprintf("📝 **Read-Write:** %s\n", rwStrs)
			}
			if superuser, ok := args["superuser"].([]interface{}); ok {
				suStrs := make([]string, len(superuser))
				for i, s := range superuser {
					suStrs[i] = s.(string)
				}
				result += fmt.Sprintf("👑 **Superuser:** %s\n", suStrs)
			}
			if comment, ok := args["comment"].(string); ok && comment != "" {
				result += fmt.Sprintf("💬 **Comment:** %s\n", comment)
			}

			result += "\n💡 Use get_export_policy to view the complete policy configuration."

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"update_export_rule",
		"Update an existing export rule in an export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"policy_name", "rule_index"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name or ID of the export policy",
				},
				"rule_index": map[string]interface{}{
					"type":        "number",
					"description": "Index of the rule to update",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy exists",
				},
				"clients": map[string]interface{}{
					"type":        "array",
					"description": "Updated client specifications",
					"items": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"match": map[string]interface{}{
								"type":        "string",
								"description": "Client specification",
							},
						},
						"required": []string{"match"},
					},
				},
				"protocols": map[string]interface{}{
					"type":        "array",
					"description": "Updated NFS protocols",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "nfs", "nfs3", "nfs4", "nfs41"},
					},
				},
				"ro_rule": map[string]interface{}{
					"type":        "array",
					"description": "Updated read-only access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"},
					},
				},
				"rw_rule": map[string]interface{}{
					"type":        "array",
					"description": "Updated read-write access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"},
					},
				},
				"superuser": map[string]interface{}{
					"type":        "array",
					"description": "Updated superuser access methods",
					"items": map[string]interface{}{
						"type": "string",
						"enum": []string{"any", "none", "never", "krb5", "krb5i", "krb5p", "ntlm", "sys"},
					},
				},
				"allow_device_creation": map[string]interface{}{
					"type":        "boolean",
					"description": "Updated device creation setting",
				},
				"allow_suid": map[string]interface{}{
					"type":        "boolean",
					"description": "Updated set UID setting",
				},
				"anonymous_user": map[string]interface{}{
					"type":        "string",
					"description": "Updated anonymous user mapping",
				},
				"comment": map[string]interface{}{
					"type":        "string",
					"description": "Updated rule comment",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policyName := args["policy_name"].(string)
			ruleIndex := int(args["rule_index"].(float64))
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			// First, resolve policy name to ID
			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			var policyID int
			found := false
			for _, policy := range policies {
				if policy.Name == policyName {
					policyID = policy.ID
					found = true
					break
				}
			}

			if !found {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Export policy '%s' not found", policyName))},
					IsError: true,
				}, nil
			}

			updates := make(map[string]interface{})

			// Parse optional update fields
			if clientsRaw, ok := args["clients"].([]interface{}); ok {
				clients := make([]map[string]string, len(clientsRaw))
				for i, c := range clientsRaw {
					if clientMap, ok := c.(map[string]interface{}); ok {
						clients[i] = map[string]string{"match": clientMap["match"].(string)}
					}
				}
				updates["clients"] = clients
			}

			if protocolsRaw, ok := args["protocols"].([]interface{}); ok {
				protocols := make([]string, len(protocolsRaw))
				for i, p := range protocolsRaw {
					protocols[i] = p.(string)
				}
				updates["protocols"] = protocols
			}

			if roRaw, ok := args["ro_rule"].([]interface{}); ok {
				ro := make([]string, len(roRaw))
				for i, r := range roRaw {
					ro[i] = r.(string)
				}
				updates["ro_rule"] = ro
			}

			if rwRaw, ok := args["rw_rule"].([]interface{}); ok {
				rw := make([]string, len(rwRaw))
				for i, r := range rwRaw {
					rw[i] = r.(string)
				}
				updates["rw_rule"] = rw
			}

			if superuserRaw, ok := args["superuser"].([]interface{}); ok {
				superuser := make([]string, len(superuserRaw))
				for i, s := range superuserRaw {
					superuser[i] = s.(string)
				}
				updates["superuser"] = superuser
			}

			if allowDevice, ok := args["allow_device_creation"].(bool); ok {
				updates["allow_device_creation"] = allowDevice
			}

			if allowSuid, ok := args["allow_suid"].(bool); ok {
				updates["allow_suid"] = allowSuid
			}

			if anonUser, ok := args["anonymous_user"].(string); ok {
				updates["anonymous_user"] = anonUser
			}

			if comment, ok := args["comment"].(string); ok {
				updates["comment"] = comment
			}

			err = client.UpdateExportRule(ctx, policyID, ruleIndex, updates)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to update export rule: %v", err))},
					IsError: true,
				}, nil
			}

			result := "✅ **Export rule updated successfully!**\n\n"
			result += fmt.Sprintf("🔐 **Policy:** %s\n", policyName)
			result += fmt.Sprintf("📏 **Rule Index:** %d\n", ruleIndex)

			if clientsRaw, ok := args["clients"].([]interface{}); ok {
				clientMatches := []string{}
				for _, c := range clientsRaw {
					if clientMap, ok := c.(map[string]interface{}); ok {
						if match, ok := clientMap["match"].(string); ok {
							clientMatches = append(clientMatches, match)
						}
					}
				}
				if len(clientMatches) > 0 {
					result += fmt.Sprintf("👥 **Clients:** %s\n", clientMatches)
				}
			}

			if protocols, ok := args["protocols"].([]interface{}); ok {
				protoStrs := make([]string, len(protocols))
				for i, p := range protocols {
					protoStrs[i] = p.(string)
				}
				result += fmt.Sprintf("🔌 **Protocols:** %s\n", protoStrs)
			}

			if ro, ok := args["ro_rule"].([]interface{}); ok {
				roStrs := make([]string, len(ro))
				for i, r := range ro {
					roStrs[i] = r.(string)
				}
				result += fmt.Sprintf("📖 **Read-Only:** %s\n", roStrs)
			}

			if rw, ok := args["rw_rule"].([]interface{}); ok {
				rwStrs := make([]string, len(rw))
				for i, r := range rw {
					rwStrs[i] = r.(string)
				}
				result += fmt.Sprintf("📝 **Read-Write:** %s\n", rwStrs)
			}

			if superuser, ok := args["superuser"].([]interface{}); ok {
				suStrs := make([]string, len(superuser))
				for i, s := range superuser {
					suStrs[i] = s.(string)
				}
				result += fmt.Sprintf("👑 **Superuser:** %s\n", suStrs)
			}

			if comment, ok := args["comment"].(string); ok {
				result += fmt.Sprintf("💬 **Comment:** %s\n", comment)
			}

			result += "\n💡 Use get_export_policy to view the complete updated configuration."

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register(
		"delete_export_rule",
		"Delete an export rule from an export policy",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"policy_name", "rule_index"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster (registry mode)",
				},
				"cluster_ip": map[string]interface{}{
					"type":        "string",
					"description": "IP address or FQDN of the ONTAP cluster (direct mode)",
				},
				"username": map[string]interface{}{
					"type":        "string",
					"description": "Username for authentication (direct mode)",
				},
				"password": map[string]interface{}{
					"type":        "string",
					"description": "Password for authentication (direct mode)",
				},
				"policy_name": map[string]interface{}{
					"type":        "string",
					"description": "Name or ID of the export policy",
				},
				"rule_index": map[string]interface{}{
					"type":        "number",
					"description": "Index of the rule to delete",
				},
				"svm_name": map[string]interface{}{
					"type":        "string",
					"description": "SVM name where policy exists",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			client, err := getApiClient(ctx, clusterManager, args)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			policyName := args["policy_name"].(string)
			ruleIndex := int(args["rule_index"].(float64))
			svmName := ""
			if svm, ok := args["svm_name"].(string); ok {
				svmName = svm
			}

			// First, resolve policy name to ID
			policies, err := client.ListExportPolicies(ctx, svmName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list export policies: %v", err))},
					IsError: true,
				}, nil
			}

			var policyID int
			found := false
			for _, policy := range policies {
				if policy.Name == policyName {
					policyID = policy.ID
					found = true
					break
				}
			}

			if !found {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Export policy '%s' not found", policyName))},
					IsError: true,
				}, nil
			}

			err = client.DeleteExportRule(ctx, policyID, ruleIndex)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete export rule: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("✅ **Export rule %d deleted successfully from policy '%s'!**\n\n", ruleIndex, policyName)
			result += "💡 Use get_export_policy to view the updated policy configuration."

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}
