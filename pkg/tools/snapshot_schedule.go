package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

// Note: Parameter helpers now in params.go for shared use across all tools

func RegisterSnapshotScheduleTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("list_snapshot_schedules", "List all snapshot schedules (cron jobs) on an ONTAP cluster", map[string]interface{}{
		"type":     "object",
		"required": []string{},
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
			"schedule_name_pattern": map[string]interface{}{
				"type":        "string",
				"description": "Filter by schedule name pattern",
			},
			"schedule_type": map[string]interface{}{
				"type":        "string",
				"description": "Filter by schedule type (cron, interval)",
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		result := fmt.Sprintf("Snapshot Schedules (%d):\n", len(schedules))
		for _, s := range schedules {
			result += fmt.Sprintf("- %s (%s)\n", s.Name, s.UUID)
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
	})

	// Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("get_snapshot_schedule", "Get detailed information about a specific snapshot schedule by name", map[string]interface{}{
		"type":     "object",
		"required": []string{"schedule_name"},
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
			"schedule_name": map[string]interface{}{
				"type":        "string",
				"description": "Name of the snapshot schedule",
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		scheduleName, err := getStringParam(args, "schedule_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				// Build human-readable summary
				summary := fmt.Sprintf("⏰ **Snapshot Schedule: %s**\n\n🆔 UUID: %s\n🔧 Type: %s\n", s.Name, s.UUID, s.Type)
				
				if s.Type == "cron" && s.Cron != nil {
					summary += "📅 **Cron Configuration:**\n"
					if len(s.Cron.Minutes) > 0 {
						summary += fmt.Sprintf("   • Minutes: %v\n", s.Cron.Minutes[0])
					}
					if len(s.Cron.Hours) > 0 {
						summary += fmt.Sprintf("   • Hours: %v\n", s.Cron.Hours[0])
					}
					if len(s.Cron.Days) > 0 {
						summary += fmt.Sprintf("   • Days: %v\n", s.Cron.Days)
					}
					if len(s.Cron.Months) > 0 {
						summary += fmt.Sprintf("   • Months: %v\n", s.Cron.Months)
					}
					if len(s.Cron.Weekdays) > 0 {
						summary += fmt.Sprintf("   • Weekdays: %v\n", s.Cron.Weekdays)
					}
					summary += "\n"
				}
				
				summary += "💡 **Usage:**\n"
				summary += "   • Use this schedule in snapshot policies\n"
				summary += fmt.Sprintf("   • Reference by name: \"%s\"\n", s.Name)

				// Build data object matching TypeScript format exactly
				data := map[string]interface{}{
					"uuid": s.UUID,
					"name": s.Name,
					"type": s.Type,
				}
				
				// Add cron details if present
				if s.Type == "cron" && s.Cron != nil {
					data["cron"] = map[string]interface{}{
						"minutes":  s.Cron.Minutes,
						"hours":    s.Cron.Hours,
					}
					if len(s.Cron.Days) > 0 {
						data["cron"].(map[string]interface{})["days"] = s.Cron.Days
					}
					if len(s.Cron.Months) > 0 {
						data["cron"].(map[string]interface{})["months"] = s.Cron.Months
					}
					if len(s.Cron.Weekdays) > 0 {
						data["cron"].(map[string]interface{})["weekdays"] = s.Cron.Weekdays
					}
				}

				// Return hybrid format as single JSON text (TypeScript-compatible)
				// Format: {summary: "human text", data: {...json object...}}
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
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})

	// create_snapshot_schedule - Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("create_snapshot_schedule", "Create a new snapshot schedule (cron job) for use in snapshot policies", map[string]interface{}{
		"type":     "object",
		"required": []string{"schedule_name", "schedule_type"},
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
			"schedule_name": map[string]interface{}{
				"type":        "string",
				"description": "Name for the snapshot schedule",
			},
			"schedule_type": map[string]interface{}{
				"type":        "string",
				"description": "Type of schedule: 'cron' for specific times, 'interval' for regular intervals",
				"enum":        []string{"cron", "interval"},
			},
			"interval": map[string]interface{}{
				"type":        "string",
				"description": "Interval string (e.g., '1h', '30m', '1d') - used with interval type",
			},
			"cron_minutes": map[string]interface{}{
				"type":        "array",
				"description": "Minutes when to run (0-59) - used with cron type",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 0,
					"maximum": 59,
				},
			},
			"cron_hours": map[string]interface{}{
				"type":        "array",
				"description": "Hours when to run (0-23) - used with cron type",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 0,
					"maximum": 23,
				},
			},
			"cron_days": map[string]interface{}{
				"type":        "array",
				"description": "Days of month when to run (1-31) - used with cron type",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 1,
					"maximum": 31,
				},
			},
			"cron_months": map[string]interface{}{
				"type":        "array",
				"description": "Months when to run (1-12) - used with cron type",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 1,
					"maximum": 12,
				},
			},
			"cron_weekdays": map[string]interface{}{
				"type":        "array",
				"description": "Days of week when to run (0-6, 0=Sunday) - used with cron type",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 0,
					"maximum": 6,
				},
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		scheduleName, err := getStringParam(args, "schedule_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		scheduleType, err := getStringParam(args, "schedule_type", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		req := map[string]interface{}{
			"name": scheduleName,
			"type": scheduleType,
		}
		if err := client.CreateSnapshotSchedule(ctx, req); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Created schedule '%s'", scheduleName)}}}, nil
	})

	// delete_snapshot_schedule - Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("delete_snapshot_schedule", "Delete a snapshot schedule. WARNING: Schedule must not be in use by any policies", map[string]interface{}{
		"type":     "object",
		"required": []string{"schedule_name"},
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
			"schedule_name": map[string]interface{}{
				"type":        "string",
				"description": "Name of the schedule to delete",
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		scheduleName, err := getStringParam(args, "schedule_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				if err := client.DeleteSnapshotSchedule(ctx, s.UUID); err != nil {
					return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
				}
				return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Deleted schedule '%s'", scheduleName)}}}, nil
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})

	// update_snapshot_schedule - Dual-mode tool: Supports both registry mode (cluster_name) and direct mode (cluster_ip/username/password)
	registry.Register("update_snapshot_schedule", "Update an existing snapshot schedule's configuration", map[string]interface{}{
		"type":     "object",
		"required": []string{"schedule_name"},
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
			"schedule_name": map[string]interface{}{
				"type":        "string",
				"description": "Name of the schedule to update",
			},
			"new_name": map[string]interface{}{
				"type":        "string",
				"description": "New name for the schedule",
			},
			"schedule_type": map[string]interface{}{
				"type":        "string",
				"description": "Updated schedule type",
				"enum":        []string{"cron", "interval"},
			},
			"interval": map[string]interface{}{
				"type":        "string",
				"description": "Updated interval string",
			},
			"cron_minutes": map[string]interface{}{
				"type":        "array",
				"description": "Updated minutes (0-59)",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 0,
					"maximum": 59,
				},
			},
			"cron_hours": map[string]interface{}{
				"type":        "array",
				"description": "Updated hours (0-23)",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 0,
					"maximum": 23,
				},
			},
			"cron_days": map[string]interface{}{
				"type":        "array",
				"description": "Updated days (1-31)",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 1,
					"maximum": 31,
				},
			},
			"cron_months": map[string]interface{}{
				"type":        "array",
				"description": "Updated months (1-12)",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 1,
					"maximum": 12,
				},
			},
			"cron_weekdays": map[string]interface{}{
				"type":        "array",
				"description": "Updated weekdays (0-6, 0=Sunday)",
				"items": map[string]interface{}{
					"type":    "number",
					"minimum": 0,
					"maximum": 6,
				},
			},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		scheduleName, err := getStringParam(args, "schedule_name", true)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}

		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				updates := make(map[string]interface{})
				if newName, ok := args["new_name"].(string); ok {
					updates["name"] = newName
				}
				if err := client.UpdateSnapshotSchedule(ctx, s.UUID, updates); err != nil {
					return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
				}
				return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Updated schedule '%s'", scheduleName)}}}, nil
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})
}
