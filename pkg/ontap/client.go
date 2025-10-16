package ontap

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
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

// ClusterManager manages multiple ONTAP cluster connections
type ClusterManager struct {
	clusters map[string]*Client
	configs  map[string]*config.ClusterConfig
	mu       sync.RWMutex
	logger   *util.Logger
}

// NewClusterManager creates a new cluster manager
func NewClusterManager(logger *util.Logger) *ClusterManager {
	return &ClusterManager{
		clusters: make(map[string]*Client),
		configs:  make(map[string]*config.ClusterConfig),
		logger:   logger,
	}
}

// AddCluster adds a cluster to the manager
func (cm *ClusterManager) AddCluster(cfg *config.ClusterConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, exists := cm.clusters[cfg.Name]; exists {
		return fmt.Errorf("cluster %s already registered", cfg.Name)
	}

	client := NewClient(cfg, cm.logger)
	cm.clusters[cfg.Name] = client
	cm.configs[cfg.Name] = cfg

	cm.logger.Debug().
		Str("cluster", cfg.Name).
		Str("ip", cfg.ClusterIP).
		Msg("Cluster added to manager")

	return nil
}

// GetClient retrieves a client for a cluster
func (cm *ClusterManager) GetClient(name string) (*Client, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	client, ok := cm.clusters[name]
	if !ok {
		return nil, fmt.Errorf("cluster not found: %s", name)
	}

	return client, nil
}

// ListClusters returns names of all registered clusters
func (cm *ClusterManager) ListClusters() []string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	names := make([]string, 0, len(cm.clusters))
	for name := range cm.clusters {
		names = append(names, name)
	}

	return names
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
	// To be implemented in Phase 2
	return fmt.Errorf("not implemented")
}

// patch performs a PATCH request to the ONTAP API
func (c *Client) patch(ctx context.Context, path string, body interface{}) error {
	// To be implemented in Phase 2
	return fmt.Errorf("not implemented")
}

// delete performs a DELETE request to the ONTAP API
func (c *Client) delete(ctx context.Context, path string) error {
	// To be implemented in Phase 2
	return fmt.Errorf("not implemented")
}
