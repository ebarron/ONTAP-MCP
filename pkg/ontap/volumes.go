package ontap

import (
	"context"
	"fmt"
	"time"
)

// ListSVMs retrieves all SVMs on the cluster
func (c *Client) ListSVMs(ctx context.Context) ([]SVM, error) {
	var response struct {
		Records []SVM `json:"records"`
	}

	if err := c.get(ctx, "/svm/svms", &response); err != nil {
		return nil, fmt.Errorf("failed to list SVMs: %w", err)
	}

	return response.Records, nil
}

// GetSVM retrieves a specific SVM by name or UUID
func (c *Client) GetSVM(ctx context.Context, nameOrUUID string) (*SVM, error) {
	var svm SVM
	path := fmt.Sprintf("/svm/svms/%s", nameOrUUID)

	if err := c.get(ctx, path, &svm); err != nil {
		return nil, fmt.Errorf("failed to get SVM: %w", err)
	}

	return &svm, nil
}

// ListAggregates retrieves all aggregates on the cluster
func (c *Client) ListAggregates(ctx context.Context, svmName string) ([]Aggregate, error) {
	var response struct {
		Records []Aggregate `json:"records"`
	}

	path := "/storage/aggregates?fields=*"
	if svmName != "" {
		// Filter aggregates assigned to specific SVM
		path += fmt.Sprintf("&svm.name=%s", svmName)
	}

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list aggregates: %w", err)
	}

	return response.Records, nil
}

// ListVolumes retrieves volumes on the cluster
func (c *Client) ListVolumes(ctx context.Context, svmName string) ([]Volume, error) {
	var response struct {
		Records []Volume `json:"records"`
	}

	path := "/storage/volumes?fields=*"
	if svmName != "" {
		path += fmt.Sprintf("&svm.name=%s", svmName)
	}

	if err := c.get(ctx, path, &response); err != nil {
		return nil, fmt.Errorf("failed to list volumes: %w", err)
	}

	return response.Records, nil
}

// GetVolume retrieves a specific volume by UUID
func (c *Client) GetVolume(ctx context.Context, uuid string) (*Volume, error) {
	var volume Volume
	path := fmt.Sprintf("/storage/volumes/%s?fields=*", uuid)

	if err := c.get(ctx, path, &volume); err != nil {
		return nil, fmt.Errorf("failed to get volume: %w", err)
	}

	return &volume, nil
}

// GetVolumeWithFullSpace gets a volume with all space fields (for autosize status)
func (c *Client) GetVolumeWithFullSpace(ctx context.Context, uuid string) (*Volume, error) {
	var volume Volume
	// Match TypeScript implementation: request autosize,size,space (ONTAP returns all nested fields)
	path := fmt.Sprintf("/storage/volumes/%s?fields=autosize,size,space", uuid)

	if err := c.get(ctx, path, &volume); err != nil {
		return nil, fmt.Errorf("failed to get volume: %w", err)
	}

	return &volume, nil
}

// CreateVolume creates a new volume
func (c *Client) CreateVolume(ctx context.Context, req *CreateVolumeRequest) (*CreateVolumeResponse, error) {
	var response CreateVolumeResponse

	if err := c.post(ctx, "/storage/volumes", req, &response); err != nil {
		return nil, fmt.Errorf("failed to create volume: %w", err)
	}

	// Handle async job response - wait for completion and find volume UUID
	if response.Job != nil && response.UUID == "" {
		// Wait for job to complete
		jobUUID := response.Job.UUID
		maxAttempts := 10

		for attempt := 1; attempt <= maxAttempts; attempt++ {
			// Wait 2 seconds between checks
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(2 * time.Second):
			}

			// Check job status
			var jobStatus struct {
				State   string `json:"state"`
				Message string `json:"message"`
			}

			jobPath := fmt.Sprintf("/cluster/jobs/%s", jobUUID)
			if err := c.get(ctx, jobPath, &jobStatus); err != nil {
				// Continue waiting if job status check fails
				continue
			}

			if jobStatus.State == "success" {
				// Job completed - now find the volume by name
				volumes, err := c.ListVolumes(ctx, req.SVM["name"])
				if err != nil {
					return nil, fmt.Errorf("job completed but failed to list volumes: %w", err)
				}

				for _, vol := range volumes {
					if vol.Name == req.Name {
						response.UUID = vol.UUID
						return &response, nil
					}
				}

				return nil, fmt.Errorf("volume '%s' not found after job completion", req.Name)
			} else if jobStatus.State == "failure" {
				return nil, fmt.Errorf("volume creation job failed: %s", jobStatus.Message)
			}
			// If state is "running" or "queued", continue waiting
		}

		return nil, fmt.Errorf("volume creation job did not complete after %d attempts", maxAttempts)
	}

	return &response, nil
}

// UpdateVolume updates volume properties
func (c *Client) UpdateVolume(ctx context.Context, uuid string, updates map[string]interface{}) error {
	path := fmt.Sprintf("/storage/volumes/%s", uuid)

	if err := c.patch(ctx, path, updates); err != nil {
		return fmt.Errorf("failed to update volume: %w", err)
	}

	return nil
}

// DeleteVolume deletes a volume (must be offline first)
func (c *Client) DeleteVolume(ctx context.Context, uuid string) error {
	path := fmt.Sprintf("/storage/volumes/%s", uuid)

	if err := c.delete(ctx, path); err != nil {
		return fmt.Errorf("failed to delete volume: %w", err)
	}

	return nil
}
