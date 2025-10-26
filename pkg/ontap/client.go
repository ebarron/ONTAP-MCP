package ontap

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

// ClusterInfo represents ONTAP cluster information
type ClusterInfo struct {
	Name      string `json:"name"`
	UUID      string `json:"uuid"`
	State     string `json:"state"`
	ClusterIP string `json:"-"`
	Version   struct {
		Generation int    `json:"generation"`
		Major      int    `json:"major"`
		Minor      int    `json:"minor"`
		Micro      int    `json:"micro"`
		Full       string `json:"full"`
	} `json:"version"`
}

// Client represents an ONTAP REST API client
type Client struct {
	baseURL    string
	auth       string
	httpClient *http.Client
	logger     *util.Logger
	clusterIP  string
}

// NewClient creates a new ONTAP API client
func NewClient(cfg *config.ClusterConfig, logger *util.Logger) *Client {
	// Create HTTP client with connection pooling
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !cfg.VerifySSL,
		},
	}

	httpClient := &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
	}

	// Create basic auth header
	auth := base64.StdEncoding.EncodeToString(
		[]byte(fmt.Sprintf("%s:%s", cfg.Username, cfg.Password)),
	)

	return &Client{
		baseURL:    fmt.Sprintf("https://%s/api", cfg.ClusterIP),
		auth:       auth,
		httpClient: httpClient,
		logger:     logger,
		clusterIP:  cfg.ClusterIP,
	}
}

// GetClusterInfo retrieves cluster information
func (c *Client) GetClusterInfo(ctx context.Context) (*ClusterInfo, error) {
	// Try the direct endpoint first (ONTAP 9.6+)
	var info ClusterInfo
	if err := c.get(ctx, "/cluster", &info); err == nil {
		info.ClusterIP = c.clusterIP
		return &info, nil
	}

	// Fall back to records format
	var response struct {
		Records []ClusterInfo `json:"records"`
	}

	if err := c.get(ctx, "/cluster", &response); err != nil {
		return nil, fmt.Errorf("failed to get cluster info: %w", err)
	}

	if len(response.Records) == 0 {
		return nil, fmt.Errorf("no cluster information returned")
	}

	info = response.Records[0]
	info.ClusterIP = c.clusterIP
	return &info, nil
}

// get performs a GET request to the ONTAP API
func (c *Client) get(ctx context.Context, path string, result interface{}) error {
	url := c.baseURL + path

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+c.auth)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API error (HTTP %d): %s", resp.StatusCode, string(body))
	}

	if err := json.Unmarshal(body, result); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	return nil
}

// post performs a POST request to the ONTAP API
func (c *Client) post(ctx context.Context, path string, body interface{}, result interface{}) error {
	url := c.baseURL + path

	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+c.auth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

// patch performs a PATCH request to the ONTAP API
func (c *Client) patch(ctx context.Context, path string, body interface{}) error {
	url := c.baseURL + path

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+c.auth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// delete performs a DELETE request to the ONTAP API
func (c *Client) delete(ctx context.Context, path string) error {
	url := c.baseURL + path

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Basic "+c.auth)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}
