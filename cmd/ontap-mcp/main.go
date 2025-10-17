package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/mcp"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
	"github.com/ebarron/ONTAP-MCP/pkg/tools"
	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

const (
	version = "2.0.0"
)

func main() {
	// CLI flags
	var (
		showVersion  = flag.Bool("version", false, "Show version and exit")
		httpMode     = flag.String("http", "", "Run in HTTP mode on specified port (e.g., --http=3000)")
		testConn     = flag.Bool("test-connection", false, "Test ONTAP cluster connections and exit")
		logLevel     = flag.String("log-level", "info", "Log level (debug, info, warn, error)")
	)
	flag.Parse()

	// Initialize logger
	logger := util.NewLogger(*logLevel)

	// Version flag
	if *showVersion {
		fmt.Printf("NetApp ONTAP MCP Server v%s (Go)\n", version)
		os.Exit(0)
	}

	// Load cluster configuration
	clusters, err := config.LoadClusters()
	if err != nil {
		logger.Error().Err(err).Msg("Failed to load cluster configuration")
		os.Exit(1)
	}

	// Initialize cluster manager
	clusterManager := ontap.NewClusterManager(logger)
	for _, cluster := range clusters {
		if err := clusterManager.AddCluster(&cluster); err != nil {
			logger.Warn().
				Str("cluster", cluster.Name).
				Err(err).
				Msg("Failed to add cluster to registry")
		}
	}

	logger.Info().
		Int("clusters", len(clusters)).
		Msg("Cluster manager initialized")

	// Test connection mode
	if *testConn {
		testConnections(clusterManager, logger)
		return
	}

	// Initialize tool registry
	registry := tools.NewRegistry(logger)
	tools.RegisterAllTools(registry, clusterManager)

	logger.Info().
		Int("tools", registry.Count()).
		Msg("Tool registry initialized")

	// Create MCP server (pass clusterManager for initializationOptions support)
	server := mcp.NewServer(registry, clusterManager, logger)

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		logger.Info().Msg("Shutdown signal received, gracefully stopping...")
		cancel()
	}()

	// Determine transport mode
	if *httpMode != "" {
		// HTTP/SSE mode
		port := parsePort(*httpMode)
		logger.Info().
			Int("port", port).
			Msg("Starting MCP server in HTTP mode (using SDK)")

		if err := server.ServeHTTPWithSDK(ctx, port); err != nil {
			logger.Error().Err(err).Msg("HTTP server failed")
			os.Exit(1)
		}
	} else {
		// STDIO mode (default for VS Code MCP)
		logger.Info().Msg("Starting MCP server in STDIO mode")

		if err := server.ServeStdio(ctx); err != nil {
			logger.Error().Err(err).Msg("STDIO server failed")
			os.Exit(1)
		}
	}
}

// parsePort extracts port number from --http flag
func parsePort(httpFlag string) int {
	// Handle --http=3000 or --http 3000
	port := 3000 // default
	if httpFlag != "" && httpFlag != "true" {
		if p, err := strconv.Atoi(strings.TrimPrefix(httpFlag, "=")); err == nil {
			port = p
		}
	}
	return port
}

// testConnections tests connectivity to all registered clusters
func testConnections(cm *ontap.ClusterManager, logger *util.Logger) {
	clusters := cm.ListClusters()
	if len(clusters) == 0 {
		logger.Warn().Msg("No clusters configured")
		return
	}

	fmt.Printf("\nTesting connections to %d cluster(s)...\n\n", len(clusters))

	successCount := 0
	for _, clusterName := range clusters {
		client, err := cm.GetClient(clusterName)
		if err != nil {
			fmt.Printf("❌ %s: Failed to get client - %v\n", clusterName, err)
			continue
		}

		info, err := client.GetClusterInfo(context.Background())
		if err != nil {
			fmt.Printf("❌ %s: Connection failed - %v\n", clusterName, err)
			continue
		}

		fmt.Printf("✅ %s: Connected successfully\n", clusterName)
		fmt.Printf("   ONTAP Version: %s\n", info.Version.Full)
		fmt.Printf("   UUID: %s\n", info.UUID)
		fmt.Printf("   State: %s\n\n", info.State)
		successCount++
	}

	fmt.Printf("Results: %d/%d clusters reachable\n", successCount, len(clusters))
	if successCount < len(clusters) {
		os.Exit(1)
	}
}
