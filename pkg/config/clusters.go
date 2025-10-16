package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// ClusterConfig represents ONTAP cluster configuration
type ClusterConfig struct {
	Name        string `json:"name"`
	ClusterIP   string `json:"cluster_ip"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	Description string `json:"description,omitempty"`
	VerifySSL   bool   `json:"verify_ssl,omitempty"`
}

// LoadClusters loads cluster configuration from ONTAP_CLUSTERS environment variable
// Supports both array format: [{"name":"...","cluster_ip":"..."}]
// and object format: {"cluster-name": {"cluster_ip":"..."}}
func LoadClusters() ([]ClusterConfig, error) {
	clustersJSON := os.Getenv("ONTAP_CLUSTERS")
	if clustersJSON == "" {
		return nil, nil // No clusters configured
	}

	var clusters []ClusterConfig

	// Try array format first
	if err := json.Unmarshal([]byte(clustersJSON), &clusters); err != nil {
		// Try object format (TypeScript compatibility)
		var clusterMap map[string]struct {
			ClusterIP   string `json:"cluster_ip"`
			Username    string `json:"username"`
			Password    string `json:"password"`
			Description string `json:"description,omitempty"`
			VerifySSL   bool   `json:"verify_ssl,omitempty"`
		}

		if err := json.Unmarshal([]byte(clustersJSON), &clusterMap); err != nil {
			return nil, fmt.Errorf("invalid ONTAP_CLUSTERS JSON (must be array or object): %w", err)
		}

		// Convert object format to array
		clusters = make([]ClusterConfig, 0, len(clusterMap))
		for name, cfg := range clusterMap {
			clusters = append(clusters, ClusterConfig{
				Name:        name,
				ClusterIP:   cfg.ClusterIP,
				Username:    cfg.Username,
				Password:    cfg.Password,
				Description: cfg.Description,
				VerifySSL:   cfg.VerifySSL,
			})
		}
	}

	// Validate clusters
	for i, cluster := range clusters {
		if cluster.Name == "" {
			return nil, fmt.Errorf("cluster %d: name is required", i)
		}
		if cluster.ClusterIP == "" {
			return nil, fmt.Errorf("cluster %s: cluster_ip is required", cluster.Name)
		}
		if cluster.Username == "" {
			return nil, fmt.Errorf("cluster %s: username is required", cluster.Name)
		}
		if cluster.Password == "" {
			return nil, fmt.Errorf("cluster %s: password is required", cluster.Name)
		}
	}

	return clusters, nil
}
