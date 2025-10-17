package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterSnapshotScheduleTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// list_snapshot_schedules - List all snapshot schedules (dual-mode)
	registry.Register("list_snapshot_schedules", "List all snapshot schedules (cron jobs) on an ONTAP cluster", map[string]interface{}{
		"type": "object", "required": []string{},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
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

	// get_snapshot_schedule - Get snapshot schedule details (dual-mode)
	registry.Register("get_snapshot_schedule", "Get detailed information about a specific snapshot schedule by name", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name of the snapshot schedule"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		scheduleName := args["schedule_name"].(string)
		schedules, err := client.ListSnapshotSchedules(ctx)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		for _, s := range schedules {
			if s.Name == scheduleName {
				result := fmt.Sprintf("Schedule: %s\nUUID: %s\nType: %s\n", s.Name, s.UUID, s.Type)
				return &CallToolResult{Content: []Content{{Type: "text", Text: result}}}, nil
			}
		}
		return &CallToolResult{Content: []Content{ErrorContent("Schedule not found")}, IsError: true}, nil
	})

	// create_snapshot_schedule - Create new snapshot schedule (dual-mode)
	registry.Register("create_snapshot_schedule", "Create a new snapshot schedule (cron job) for use in snapshot policies", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name", "schedule_type"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name for the snapshot schedule"},
			"schedule_type": map[string]interface{}{"type": "string", "description": "Type: 'cron' or 'interval'", "enum": []string{"cron", "interval"}},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		req := map[string]interface{}{
			"name": args["schedule_name"].(string),
			"type": args["schedule_type"].(string),
		}
		if err := client.CreateSnapshotSchedule(ctx, req); err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(fmt.Sprintf("Failed: %v", err))}, IsError: true}, nil
		}
		return &CallToolResult{Content: []Content{{Type: "text", Text: fmt.Sprintf("Created schedule '%s'", args["schedule_name"])}}}, nil
	})

	// delete_snapshot_schedule - Delete snapshot schedule (dual-mode)
	registry.Register("delete_snapshot_schedule", "Delete a snapshot schedule. WARNING: Schedule must not be in use by any policies", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name of the schedule to delete"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		scheduleName := args["schedule_name"].(string)
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

	// update_snapshot_schedule - Update snapshot schedule (dual-mode)
	registry.Register("update_snapshot_schedule", "Update an existing snapshot schedule's configuration", map[string]interface{}{
		"type": "object", "required": []string{"schedule_name"},
		"properties": map[string]interface{}{
			"cluster_name": map[string]interface{}{"type": "string"}, "cluster_ip": map[string]interface{}{"type": "string"},
			"username": map[string]interface{}{"type": "string"}, "password": map[string]interface{}{"type": "string"},
			"schedule_name": map[string]interface{}{"type": "string", "description": "Name of the schedule to update"},
			"new_name": map[string]interface{}{"type": "string", "description": "New name for the schedule"},
		},
	}, func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
		client, err := getApiClient(clusterManager, args)
		if err != nil {
			return &CallToolResult{Content: []Content{ErrorContent(err.Error())}, IsError: true}, nil
		}
		scheduleName := args["schedule_name"].(string)
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
