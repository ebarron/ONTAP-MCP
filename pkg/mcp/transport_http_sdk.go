package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
	"github.com/ebarron/ONTAP-MCP/pkg/session"
	"github.com/ebarron/ONTAP-MCP/pkg/tools"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

// Context key for cluster manager (use plain string for cross-package compatibility)
const clusterManagerContextKey = "mcp-cluster-manager"

// ServeHTTPWithSDK runs the MCP server using the official MCP Go SDK
func (s *Server) ServeHTTPWithSDK(ctx context.Context, port int) error {
	// Create ONE MCP server for all sessions
	// Tools will dynamically look up session-specific data from SDK's ServerSession
	mcpServer := sdk.NewServer(
		&sdk.Implementation{
			Name:    "ontap-mcp-server",
			Version: "2.0.0",
		},
		&sdk.ServerOptions{
			Instructions: "NetApp ONTAP MCP Server - Provides tools for managing ONTAP storage clusters including volumes, CIFS shares, NFS exports, snapshots, and QoS policies.",
		},
	)

	// Register tools with session-aware handlers
	if err := s.registerSessionAwareTools(mcpServer); err != nil {
		return fmt.Errorf("failed to register tools: %w", err)
	}

	s.logger.Info().Msg("MCP server created with session-aware tools")

	// Create SDK handler - same server for all sessions
	handler := sdk.NewStreamableHTTPHandler(func(r *http.Request) *sdk.Server {
		return mcpServer
	}, nil)

	// Wrap with CORS middleware
	wrappedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Mcp-Protocol-Version, Mcp-Session-Id")
		w.Header().Set("Access-Control-Expose-Headers", "Mcp-Session-Id")

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

// registerSessionAwareTools registers all tools with handlers that extract session ID from SDK's ServerSession
func (s *Server) registerSessionAwareTools(mcpServer *sdk.Server) error {
	// Create a temporary registry to get tool definitions
	// This registry is ONLY used for getting tool schemas, not for execution
	tempRegistry := tools.NewRegistry(s.logger)
	tempClusterManager := ontap.NewClusterManager(s.logger)
	tools.RegisterAllTools(tempRegistry, tempClusterManager)

	s.logger.Debug().
		Int("tool_count", len(tempRegistry.ListTools())).
		Msg("Registering session-aware tools")

	toolDefs := tempRegistry.ListTools()

	for _, toolDef := range toolDefs {
		// Capture loop variables for closure
		currentToolName := toolDef.Name
		currentToolDesc := toolDef.Description
		currentToolSchema := toolDef.InputSchema

		// Create SDK-compatible tool definition
		sdkTool := &sdk.Tool{
			Name:        currentToolName,
			Description: currentToolDesc,
			InputSchema: currentToolSchema,
		}

		// Create session-aware handler
		handler := func(ctx context.Context, req *sdk.CallToolRequest, args map[string]interface{}) (*sdk.CallToolResult, any, error) {
			// Extract session ID from SDK's ServerSession (the proper way!)
			sessionID := req.Session.ID()
			
			// Get global session manager
			sessionMgr := session.GetGlobalSessionManager()
			if sessionMgr == nil {
				s.logger.Error().Msg("Global SessionManager not initialized!")
				return &sdk.CallToolResult{
					Content: []sdk.Content{
						&sdk.TextContent{Text: "Internal error: SessionManager not initialized"},
					},
					IsError: true,
				}, nil, nil
			}
			
			// Get or create session data for this session ID
			sessionData := sessionMgr.GetOrCreateSession(sessionID)
			
			s.logger.Info().
				Str("tool", currentToolName).
				Str("session_id", sessionID).
				Str("cluster_manager_ptr", fmt.Sprintf("%p", sessionData.ClusterManager)).
				Int("clusters", len(sessionData.ClusterManager.ListClusters())).
				Msg("Tool execution: Using SDK ServerSession.ID() for session isolation")
			
			// Inject session's cluster manager into context so tools can access it
			ctxWithClusterManager := context.WithValue(ctx, clusterManagerContextKey, sessionData.ClusterManager)
			
			// Execute tool using the temp registry
			result, err := tempRegistry.ExecuteTool(ctxWithClusterManager, currentToolName, args)
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

		// Add tool to SDK server
		sdk.AddTool(mcpServer, sdkTool, handler)
	}

	s.logger.Info().
		Int("tool_count", len(toolDefs)).
		Msg("Registered session-aware tools")

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
