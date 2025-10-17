package config

import (
	"encoding/json"
	"fmt"
	"os"
)

// Config represents the application configuration
type Config struct {
	Clusters []ClusterConfig `json:"clusters"`
	Server   ServerConfig    `json:"server"`
	Logging  LoggingConfig   `json:"logging"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	HTTPPort int    `json:"http_port"`
	Host     string `json:"host"`
}

// LoggingConfig represents logging configuration
type LoggingConfig struct {
	Level  string `json:"level"`  // debug, info, warn, error
	Format string `json:"format"` // json, console
}

// Load loads configuration from environment variables and defaults
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			HTTPPort: 3000,
			Host:     "0.0.0.0",
		},
		Logging: LoggingConfig{
			Level:  getEnv("LOG_LEVEL", "info"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
	}

	// Load clusters from environment
	clusters, err := LoadClusters()
	if err != nil {
		return nil, fmt.Errorf("failed to load clusters: %w", err)
	}
	cfg.Clusters = clusters

	return cfg, nil
}

// LoadFromFile loads configuration from a JSON file
func LoadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &cfg, nil
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
