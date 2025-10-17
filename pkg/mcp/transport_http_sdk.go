package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// ServeHTTPWithSDK runs the MCP server using the official MCP Go SDK
func (s *Server) ServeHTTPWithSDK(ctx context.Context, port int) error {
	// Create MCP SDK server
	mcpServer := sdk.NewServer(
		&sdk.Implementation{
			Name:    "ontap-mcp-server",
			Version: "2.0.0",
		},
		&sdk.ServerOptions{
			Instructions: "NetApp ONTAP MCP Server - Provides tools for managing ONTAP storage clusters including volumes, CIFS shares, NFS exports, snapshots, and QoS policies.",
		},
	)

	// Register all tools from our registry with the SDK server
	if err := s.registerToolsWithSDK(mcpServer); err != nil {
		return fmt.Errorf("failed to register tools: %w", err)
	}

	// Create HTTP handler using SDK's StreamableHTTPHandler
	handler := sdk.NewStreamableHTTPHandler(func(r *http.Request) *sdk.Server {
		// For each request, we return the same server
		// The SDK handles session management internally
		return mcpServer
	}, nil)

	// Wrap with CORS middleware
	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Mcp-Protocol-Version, Mcp-Session-Id")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		handler.ServeHTTP(w, r)
	})

	// Add health check endpoint
	mux := http.NewServeMux()
	mux.Handle("/mcp", wrappedHandler)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "healthy",
			"server":  "NetApp ONTAP MCP Server",
			"version": "2.0.0",
		})
	})

	addr := fmt.Sprintf(":%d", port)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		<-ctx.Done()
		s.logger.Info().Msg("Shutting down HTTP server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		httpServer.Shutdown(shutdownCtx)
	}()

	s.logger.Info().
		Int("port", port).
		Str("endpoint", fmt.Sprintf("http://localhost:%d/mcp", port)).
		Msg("HTTP server listening")

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("HTTP server error: %w", err)
	}

	return nil
}

// registerToolsWithSDK registers all our tools with the MCP SDK server
func (s *Server) registerToolsWithSDK(mcpServer *sdk.Server) error {
	toolDefs := s.registry.ListTools()
	
	s.logger.Info().
		Int("count", len(toolDefs)).
		Msg("Registering tools with MCP SDK")

	for _, toolDef := range toolDefs {
		// Capture loop variables for closure (critical for Go closures in loops)
		currentToolName := toolDef.Name
		currentToolDesc := toolDef.Description
		
		// Create SDK-compatible tool definition
		sdkTool := &sdk.Tool{
			Name:        currentToolName,
			Description: currentToolDesc,
			// InputSchema will be handled by the SDK
		}

		// Create handler that wraps our internal tool execution
		handler := func(ctx context.Context, req *sdk.CallToolRequest, args map[string]interface{}) (*sdk.CallToolResult, any, error) {
			// Execute our internal tool (using captured variable)
			result, err := s.registry.ExecuteTool(ctx, currentToolName, args)
			if err != nil {
				return &sdk.CallToolResult{
					Content: []sdk.Content{
						&sdk.TextContent{Text: fmt.Sprintf("Tool execution failed: %v", err)},
					},
					IsError: true,
				}, nil, nil
			}

			// Convert our result to SDK format
			sdkResult := &sdk.CallToolResult{
				IsError: result.IsError,
			}

			// Convert content
			for _, c := range result.Content {
				sdkResult.Content = append(sdkResult.Content, &sdk.TextContent{
					Text: c.Text,
				})
			}

			return sdkResult, nil, nil
		}

		// Add tool to SDK server using the SDK's AddTool function
		sdk.AddTool(mcpServer, sdkTool, handler)

		s.logger.Debug().Str("tool", currentToolName).Msg("Registered tool")
	}

	return nil
}

// Helper to load clusters from initialization options (for SDK integration)
func (s *Server) LoadClustersFromInitOptions(initOptions map[string]interface{}) error {
	clustersData, ok := initOptions["clusters"]
	if !ok {
		// Try ONTAP_CLUSTERS key (environment variable pass-through)
		clustersData, ok = initOptions["ONTAP_CLUSTERS"]
		if !ok {
			return fmt.Errorf("no clusters found in initialization options")
		}
	}

	// Parse clusters data
	var clusters []config.ClusterConfig
	
	// Handle both JSON string and object formats
	switch v := clustersData.(type) {
	case string:
		if err := json.Unmarshal([]byte(v), &clusters); err != nil {
			return fmt.Errorf("failed to parse clusters JSON string: %w", err)
		}
	case []interface{}:
		// Convert array of interfaces to cluster configs
		data, err := json.Marshal(v)
		if err != nil {
			return fmt.Errorf("failed to marshal clusters array: %w", err)
		}
		if err := json.Unmarshal(data, &clusters); err != nil {
			return fmt.Errorf("failed to unmarshal clusters array: %w", err)
		}
	case map[string]interface{}:
		// Object format: {cluster-name: {cluster_ip:..., username:..., password:...}}
		for name, clusterData := range v {
			clusterMap, ok := clusterData.(map[string]interface{})
			if !ok {
				continue
			}
			
			cluster := config.ClusterConfig{Name: name}
			if ip, ok := clusterMap["cluster_ip"].(string); ok {
				cluster.ClusterIP = ip
			}
			if user, ok := clusterMap["username"].(string); ok {
				cluster.Username = user
			}
			if pass, ok := clusterMap["password"].(string); ok {
				cluster.Password = pass
			}
			if desc, ok := clusterMap["description"].(string); ok {
				cluster.Description = desc
			}
			
			clusters = append(clusters, cluster)
		}
	default:
		return fmt.Errorf("unsupported clusters data format: %T", v)
	}

	// Add clusters to cluster manager
	for _, cluster := range clusters {
		if cluster.ClusterIP == "" || cluster.Username == "" || cluster.Password == "" {
			s.logger.Warn().
				Str("cluster", cluster.Name).
				Msg("Skipping cluster with missing required fields")
			continue
		}

		if err := s.clusterManager.AddCluster(&cluster); err != nil {
			s.logger.Warn().
				Str("cluster", cluster.Name).
				Err(err).
				Msg("Failed to add cluster")
			continue
		}
		
		s.logger.Info().
			Str("cluster", cluster.Name).
			Str("cluster_ip", cluster.ClusterIP).
			Msg("Loaded cluster from initialization options")
	}

	return nil
}
