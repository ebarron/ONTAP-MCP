package ontap

import (
	"context"
	"fmt"
)

// ListCIFSShares retrieves CIFS/SMB shares
func (c *Client) ListCIFSShares(ctx context.Context, svmName string, shareName string) ([]CIFSShare, error) {
	var response struct {
		Records []CIFSShare `json:"records"`
	}

	path := "/protocols/cifs/shares?fields=*"
	if svmName != "" {
		path += fmt.Sprintf("&svm.name=%s", svmName)
	}
	if shareName != "" {
		path += fmt.Sprintf("&name=%s", shareName)
	}

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list CIFS shares: %w", err)
	}

	return response.Records, nil
}

// GetCIFSShare retrieves a specific CIFS share
func (c *Client) GetCIFSShare(ctx context.Context, svmUUID, shareName string) (*CIFSShare, error) {
	var share CIFSShare
	path := fmt.Sprintf("/protocols/cifs/shares/%s/%s?fields=*", svmUUID, shareName)

	if err := c.get(ctx, path, &share); err != nil {
		return nil, fmt.Errorf("failed to get CIFS share: %w", err)
	}

	return &share, nil
}

// CreateCIFSShare creates a new CIFS/SMB share
func (c *Client) CreateCIFSShare(ctx context.Context, req map[string]interface{}) error {
	if err := c.post(ctx, "/protocols/cifs/shares", req, nil); err != nil {
		return fmt.Errorf("failed to create CIFS share: %w", err)
	}
	return nil
}

// UpdateCIFSShare updates a CIFS share
func (c *Client) UpdateCIFSShare(ctx context.Context, svmUUID, shareName string, updates map[string]interface{}) error {
	path := fmt.Sprintf("/protocols/cifs/shares/%s/%s", svmUUID, shareName)

	if err := c.patch(ctx, path, updates); err != nil {
		return fmt.Errorf("failed to update CIFS share: %w", err)
	}

	return nil
}

// DeleteCIFSShare deletes a CIFS share
func (c *Client) DeleteCIFSShare(ctx context.Context, svmUUID, shareName string) error {
	path := fmt.Sprintf("/protocols/cifs/shares/%s/%s", svmUUID, shareName)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete CIFS share: %w", err)
	}

	return nil
}

// ListExportPolicies retrieves NFS export policies
func (c *Client) ListExportPolicies(ctx context.Context, svmName string) ([]ExportPolicy, error) {
	var response struct {
		Records []ExportPolicy `json:"records"`
	}

	path := "/protocols/nfs/export-policies?fields=*"
	if svmName != "" {
		path += fmt.Sprintf("&svm.name=%s", svmName)
	}

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list export policies: %w", err)
	}

	return response.Records, nil
}

// GetExportPolicy retrieves a specific export policy with rules
func (c *Client) GetExportPolicy(ctx context.Context, policyID int) (*ExportPolicy, error) {
	var policy ExportPolicy
	path := fmt.Sprintf("/protocols/nfs/export-policies/%d?fields=*", policyID)

	if err := c.get(ctx, path, &policy); err != nil {
		return nil, fmt.Errorf("failed to get export policy: %w", err)
	}

	return &policy, nil
}

// CreateExportPolicy creates a new export policy
func (c *Client) CreateExportPolicy(ctx context.Context, req map[string]interface{}) error {
	if err := c.post(ctx, "/protocols/nfs/export-policies", req, nil); err != nil {
		return fmt.Errorf("failed to create export policy: %w", err)
	}
	return nil
}

// DeleteExportPolicy deletes an export policy
func (c *Client) DeleteExportPolicy(ctx context.Context, policyID int) error {
	path := fmt.Sprintf("/protocols/nfs/export-policies/%d", policyID)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete export policy: %w", err)
	}

	return nil
}

// AddExportRule adds a rule to an export policy
func (c *Client) AddExportRule(ctx context.Context, policyID int, rule map[string]interface{}) error {
	path := fmt.Sprintf("/protocols/nfs/export-policies/%d/rules", policyID)

	if err := c.post(ctx, path, rule, nil); err != nil {
		return fmt.Errorf("failed to add export rule: %w", err)
	}

	return nil
}

// UpdateExportRule updates an export rule
func (c *Client) UpdateExportRule(ctx context.Context, policyID, ruleIndex int, updates map[string]interface{}) error {
	path := fmt.Sprintf("/protocols/nfs/export-policies/%d/rules/%d", policyID, ruleIndex)

	if err := c.patch(ctx, path, updates); err != nil {
		return fmt.Errorf("failed to update export rule: %w", err)
	}

	return nil
}

// DeleteExportRule deletes an export rule
func (c *Client) DeleteExportRule(ctx context.Context, policyID, ruleIndex int) error {
	path := fmt.Sprintf("/protocols/nfs/export-policies/%d/rules/%d", policyID, ruleIndex)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete export rule: %w", err)
	}

	return nil
}

// ListSnapshotPolicies retrieves snapshot policies
func (c *Client) ListSnapshotPolicies(ctx context.Context, svmName string) ([]SnapshotPolicy, error) {
	var response struct {
		Records []SnapshotPolicy `json:"records"`
	}

	path := "/storage/snapshot-policies?fields=*"
	if svmName != "" {
		path += fmt.Sprintf("&svm.name=%s", svmName)
	}

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list snapshot policies: %w", err)
	}

	return response.Records, nil
}

// GetSnapshotPolicy retrieves a specific snapshot policy
func (c *Client) GetSnapshotPolicy(ctx context.Context, uuid string) (*SnapshotPolicy, error) {
	var policy SnapshotPolicy
	path := fmt.Sprintf("/storage/snapshot-policies/%s?fields=*", uuid)

	if err := c.get(ctx, path, &policy); err != nil {
		return nil, fmt.Errorf("failed to get snapshot policy: %w", err)
	}

	return &policy, nil
}

// CreateSnapshotPolicy creates a new snapshot policy
func (c *Client) CreateSnapshotPolicy(ctx context.Context, req map[string]interface{}) error {
	if err := c.post(ctx, "/storage/snapshot-policies", req, nil); err != nil {
		return fmt.Errorf("failed to create snapshot policy: %w", err)
	}
	return nil
}

// DeleteSnapshotPolicy deletes a snapshot policy
func (c *Client) DeleteSnapshotPolicy(ctx context.Context, uuid string) error {
	path := fmt.Sprintf("/storage/snapshot-policies/%s", uuid)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete snapshot policy: %w", err)
	}

	return nil
}

// ListQoSPolicies retrieves QoS policies
func (c *Client) ListQoSPolicies(ctx context.Context, svmName string) ([]QoSPolicy, error) {
	var response struct {
		Records []QoSPolicy `json:"records"`
	}

	path := "/storage/qos/policies?fields=*"
	if svmName != "" {
		path += fmt.Sprintf("&svm.name=%s", svmName)
	}

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list QoS policies: %w", err)
	}

	return response.Records, nil
}

// GetQoSPolicy retrieves a specific QoS policy
func (c *Client) GetQoSPolicy(ctx context.Context, uuid string) (*QoSPolicy, error) {
	var policy QoSPolicy
	path := fmt.Sprintf("/storage/qos/policies/%s?fields=*", uuid)

	if err := c.get(ctx, path, &policy); err != nil {
		return nil, fmt.Errorf("failed to get QoS policy: %w", err)
	}

	return &policy, nil
}

// CreateQoSPolicy creates a new QoS policy
func (c *Client) CreateQoSPolicy(ctx context.Context, req map[string]interface{}) error {
	if err := c.post(ctx, "/storage/qos/policies", req, nil); err != nil {
		return fmt.Errorf("failed to create QoS policy: %w", err)
	}
	return nil
}

// UpdateQoSPolicy updates a QoS policy
func (c *Client) UpdateQoSPolicy(ctx context.Context, uuid string, updates map[string]interface{}) error {
	path := fmt.Sprintf("/storage/qos/policies/%s", uuid)

	if err := c.patch(ctx, path, updates); err != nil {
		return fmt.Errorf("failed to update QoS policy: %w", err)
	}

	return nil
}

// DeleteQoSPolicy deletes a QoS policy
func (c *Client) DeleteQoSPolicy(ctx context.Context, uuid string) error {
	path := fmt.Sprintf("/storage/qos/policies/%s", uuid)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete QoS policy: %w", err)
	}

	return nil
}

// ListVolumeSnapshots retrieves snapshots for a volume
func (c *Client) ListVolumeSnapshots(ctx context.Context, volumeUUID string) ([]VolumeSnapshot, error) {
	var response struct {
		Records []VolumeSnapshot `json:"records"`
	}

	path := fmt.Sprintf("/storage/volumes/%s/snapshots?fields=*", volumeUUID)

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list volume snapshots: %w", err)
	}

	return response.Records, nil
}

// GetVolumeSnapshot retrieves a specific snapshot
func (c *Client) GetVolumeSnapshot(ctx context.Context, volumeUUID, snapshotUUID string) (*VolumeSnapshot, error) {
	var snapshot VolumeSnapshot
	path := fmt.Sprintf("/storage/volumes/%s/snapshots/%s?fields=*", volumeUUID, snapshotUUID)

	if err := c.get(ctx, path, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to get volume snapshot: %w", err)
	}

	return &snapshot, nil
}

// DeleteVolumeSnapshot deletes a volume snapshot
func (c *Client) DeleteVolumeSnapshot(ctx context.Context, volumeUUID, snapshotUUID string) error {
	path := fmt.Sprintf("/storage/volumes/%s/snapshots/%s", volumeUUID, snapshotUUID)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete volume snapshot: %w", err)
	}

	return nil
}

// GetVolumeAutosize retrieves autosize configuration for a volume
func (c *Client) GetVolumeAutosize(ctx context.Context, volumeUUID string) (*VolumeAutosize, error) {
	var volume struct {
		Autosize *VolumeAutosize `json:"autosize"`
	}
	path := fmt.Sprintf("/storage/volumes/%s?fields=autosize.*", volumeUUID)

	if err := c.get(ctx, path, &volume); err != nil {
		return nil, fmt.Errorf("failed to get volume autosize: %w", err)
	}

	return volume.Autosize, nil
}

// EnableVolumeAutosize enables or configures volume autosize
func (c *Client) EnableVolumeAutosize(ctx context.Context, volumeUUID string, config map[string]interface{}) error {
	updates := map[string]interface{}{
		"autosize": config,
	}

	if err := c.patch(ctx, fmt.Sprintf("/storage/volumes/%s", volumeUUID), updates); err != nil {
		return fmt.Errorf("failed to configure volume autosize: %w", err)
	}

	return nil
}

// =========================
// Snapshot Schedule Operations
// =========================

// ListSnapshotSchedules lists all snapshot schedules
func (c *Client) ListSnapshotSchedules(ctx context.Context) ([]SnapshotSchedule, error) {
	var response struct {
		Records []SnapshotSchedule `json:"records"`
	}
	if err := c.get(ctx, "/cluster/schedules", &response); err != nil {
		return nil, fmt.Errorf("failed to list snapshot schedules: %w", err)
	}
	return response.Records, nil
}

// GetSnapshotSchedule gets a specific snapshot schedule by UUID
func (c *Client) GetSnapshotSchedule(ctx context.Context, scheduleUUID string) (*SnapshotSchedule, error) {
	var schedule SnapshotSchedule
	if err := c.get(ctx, fmt.Sprintf("/cluster/schedules/%s", scheduleUUID), &schedule); err != nil {
		return nil, fmt.Errorf("failed to get snapshot schedule: %w", err)
	}
	return &schedule, nil
}

// CreateSnapshotSchedule creates a new snapshot schedule
func (c *Client) CreateSnapshotSchedule(ctx context.Context, schedule map[string]interface{}) error {
	var result interface{}
	if err := c.post(ctx, "/cluster/schedules", schedule, &result); err != nil {
		return fmt.Errorf("failed to create snapshot schedule: %w", err)
	}
	return nil
}

// DeleteSnapshotSchedule deletes a snapshot schedule
func (c *Client) DeleteSnapshotSchedule(ctx context.Context, scheduleUUID string) error {
	if err := c.delete(ctx, fmt.Sprintf("/cluster/schedules/%s", scheduleUUID)); err != nil {
		return fmt.Errorf("failed to delete snapshot schedule: %w", err)
	}
	return nil
}

// UpdateSnapshotSchedule updates a snapshot schedule
func (c *Client) UpdateSnapshotSchedule(ctx context.Context, scheduleUUID string, updates map[string]interface{}) error {
	if err := c.patch(ctx, fmt.Sprintf("/cluster/schedules/%s", scheduleUUID), updates); err != nil {
		return fmt.Errorf("failed to update snapshot schedule: %w", err)
	}
	return nil
}
