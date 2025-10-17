package tools

import (
	"context"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
)

func RegisterVolumeSnapshotTools(registry *Registry, clusterManager *ontap.ClusterManager) {
	// 1. cluster_list_volume_snapshots - List snapshots for a volume
	registry.Register(
		"cluster_list_volume_snapshots",
		"List all snapshots for a volume on a registered cluster. Snapshots can be sorted by creation time, size, or name.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			snapshots, err := client.ListVolumeSnapshots(ctx, volumeUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to list volume snapshots: %v", err))},
					IsError: true,
				}, nil
			}

			if len(snapshots) == 0 {
				return &CallToolResult{
					Content: []Content{{Type: "text", Text: "No snapshots found"}},
				}, nil
			}

			result := fmt.Sprintf("Snapshots for volume %s (%d):\n", volumeUUID, len(snapshots))
			for _, snap := range snapshots {
				result += fmt.Sprintf("- %s (%s)", snap.Name, snap.UUID)
				result += fmt.Sprintf(", Created: %s", snap.CreateTime)
				if snap.Size > 0 {
					sizeGB := float64(snap.Size) / (1024 * 1024 * 1024)
					result += fmt.Sprintf(", Size: %.2f GB", sizeGB)
				}
				result += "\n"
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 2. cluster_delete_volume_snapshot - Delete a volume snapshot
	registry.Register(
		"cluster_delete_volume_snapshot",
		"Delete a volume snapshot on a registered cluster to reclaim space. WARNING: This permanently removes the snapshot and cannot be undone.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid", "snapshot_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"snapshot_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the snapshot to delete",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)
			snapshotUUID := args["snapshot_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			err = client.DeleteVolumeSnapshot(ctx, volumeUUID, snapshotUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to delete snapshot: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Successfully deleted snapshot %s from volume %s", snapshotUUID, volumeUUID)

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)

	// 3. cluster_get_volume_snapshot_info - Get snapshot details
	registry.Register(
		"cluster_get_volume_snapshot_info",
		"Get detailed information about a specific volume snapshot on a registered cluster, including creation time, size, state, and any comments.",
		map[string]interface{}{
			"type":     "object",
			"required": []string{"cluster_name", "volume_uuid", "snapshot_uuid"},
			"properties": map[string]interface{}{
				"cluster_name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the registered cluster",
				},
				"volume_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the volume",
				},
				"snapshot_uuid": map[string]interface{}{
					"type":        "string",
					"description": "UUID of the snapshot",
				},
			},
		},
		func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error) {
			clusterName := args["cluster_name"].(string)
			volumeUUID := args["volume_uuid"].(string)
			snapshotUUID := args["snapshot_uuid"].(string)

			client, err := clusterManager.GetClient(clusterName)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get cluster client: %v", err))},
					IsError: true,
				}, nil
			}

			snapshot, err := client.GetVolumeSnapshot(ctx, volumeUUID, snapshotUUID)
			if err != nil {
				return &CallToolResult{
					Content: []Content{ErrorContent(fmt.Sprintf("Failed to get snapshot: %v", err))},
					IsError: true,
				}, nil
			}

			result := fmt.Sprintf("Snapshot: %s\n", snapshot.Name)
			result += fmt.Sprintf("UUID: %s\n", snapshot.UUID)
			result += fmt.Sprintf("Created: %s\n", snapshot.CreateTime)
			result += fmt.Sprintf("State: %s\n", snapshot.State)
			if snapshot.Size > 0 {
				sizeGB := float64(snapshot.Size) / (1024 * 1024 * 1024)
				result += fmt.Sprintf("Size: %.2f GB\n", sizeGB)
			}
			if snapshot.Comment != "" {
				result += fmt.Sprintf("Comment: %s\n", snapshot.Comment)
			}

			return &CallToolResult{
				Content: []Content{{Type: "text", Text: result}},
			}, nil
		},
	)
}
