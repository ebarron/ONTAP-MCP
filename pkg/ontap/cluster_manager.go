package ontap

import (
	"fmt"
	"sync"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

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
// If cluster already exists, it is overwritten (matches TypeScript behavior)
func (cm *ClusterManager) AddCluster(cfg *config.ClusterConfig) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

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

// GetClusterConfig retrieves the configuration for a cluster
func (cm *ClusterManager) GetClusterConfig(name string) (*config.ClusterConfig, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	cfg, ok := cm.configs[name]
	if !ok {
		return nil, fmt.Errorf("cluster not found: %s", name)
	}

	return cfg, nil
}

// ListClusterConfigs returns all cluster configurations
func (cm *ClusterManager) ListClusterConfigs() []*config.ClusterConfig {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	configs := make([]*config.ClusterConfig, 0, len(cm.configs))
	for _, cfg := range cm.configs {
		configs = append(configs, cfg)
	}

	return configs
}
