package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/config"
	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
	"github.com/ebarron/ONTAP-MCP/pkg/tools"
	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

// Server implements the MCP protocol server
type Server struct {
	registry       *tools.Registry
	clusterManager *ontap.ClusterManager
	logger         *util.Logger
	version        string
}

// NewServer creates a new MCP server
func NewServer(registry *tools.Registry, clusterManager *ontap.ClusterManager, logger *util.Logger) *Server {
	return &Server{
		registry:       registry,
		clusterManager: clusterManager,
		logger:         logger,
		version:        "2025-06-18", // MCP protocol version
	}
}

// HandleRequest processes a JSON-RPC request and returns a response
func (s *Server) HandleRequest(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	s.logger.Debug().
		Str("method", req.Method).
		Interface("id", req.ID).
		Msg("Handling request")

	switch req.Method {
	case "initialize":
		return s.handleInitialize(ctx, req)
	case "tools/list":
		return s.handleListTools(ctx, req)
	case "tools/call":
		return s.handleCallTool(ctx, req)
	case "ping":
		return s.handlePing(ctx, req)
	default:
		s.logger.Warn().
			Str("method", req.Method).
			Msg("Unknown method")
		return NewJSONRPCError(
			req.ID,
			ErrCodeMethodNotFound,
			fmt.Sprintf("Method not found: %s", req.Method),
			nil,
		)
	}
}

// handleInitialize handles the initialize request
func (s *Server) handleInitialize(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	var initReq InitializeRequest
	if err := json.Unmarshal(req.Params, &initReq); err != nil {
		return NewJSONRPCError(
			req.ID,
			ErrCodeInvalidParams,
			"Invalid initialize parameters",
			err.Error(),
		)
	}

	s.logger.Info().
		Str("client", initReq.ClientInfo.Name).
		Str("version", initReq.ClientInfo.Version).
		Bool("has_init_options", initReq.InitializationOptions != nil).
		Msg("Client initializing")

	// Load clusters from initializationOptions if provided
	if initReq.InitializationOptions != nil {
		if err := s.loadClustersFromInitOptions(initReq.InitializationOptions); err != nil {
			s.logger.Warn().Err(err).Msg("Failed to load clusters from initializationOptions")
		}
	}

	result := InitializeResult{
		ProtocolVersion: s.version,
		Capabilities: ServerCapabilities{
			Tools: &ToolsCapability{
				ListChanged: false,
			},
		},
		ServerInfo: Implementation{
			Name:    "ontap-mcp-server",
			Version: "2.0.0",
		},
		Instructions: "NetApp ONTAP MCP Server - Provides tools for managing ONTAP storage clusters including volumes, CIFS shares, NFS exports, snapshots, and QoS policies.",
	}

	resp, err := NewJSONRPCResponse(req.ID, result)
	if err != nil {
		return NewJSONRPCError(
			req.ID,
			ErrCodeInternalError,
			"Failed to create response",
			err.Error(),
		)
	}

	return resp
}

// loadClustersFromInitOptions loads clusters from MCP initializationOptions
// Matches TypeScript behavior: supports both array and object formats
func (s *Server) loadClustersFromInitOptions(initOptions map[string]interface{}) error {
	// Look for ONTAP_CLUSTERS in initializationOptions
	ontapClusters, ok := initOptions["ONTAP_CLUSTERS"]
	if !ok {
		return nil // No clusters in init options
	}

	// Convert to JSON and parse using existing config loader
	clustersJSON, err := json.Marshal(ontapClusters)
	if err != nil {
		return fmt.Errorf("failed to marshal clusters: %w", err)
	}

	var clusters []config.ClusterConfig

	// Try array format first
	if err := json.Unmarshal(clustersJSON, &clusters); err != nil {
		// Try object format (TypeScript compatibility)
		var clusterMap map[string]struct {
			ClusterIP   string `json:"cluster_ip"`
			Username    string `json:"username"`
			Password    string `json:"password"`
			Description string `json:"description,omitempty"`
			VerifySSL   bool   `json:"verify_ssl,omitempty"`
		}

		if err := json.Unmarshal(clustersJSON, &clusterMap); err != nil {
			return fmt.Errorf("invalid ONTAP_CLUSTERS format in initializationOptions: %w", err)
		}

		// Convert object format to array
		clusters = make([]config.ClusterConfig, 0, len(clusterMap))
		for name, cfg := range clusterMap {
			clusters = append(clusters, config.ClusterConfig{
				Name:        name,
				ClusterIP:   cfg.ClusterIP,
				Username:    cfg.Username,
				Password:    cfg.Password,
				Description: cfg.Description,
				VerifySSL:   cfg.VerifySSL,
			})
		}
	}

	// Add clusters to manager
	addedCount := 0
	for _, cluster := range clusters {
		if err := s.clusterManager.AddCluster(&cluster); err != nil {
			s.logger.Warn().
				Str("cluster", cluster.Name).
				Err(err).
				Msg("Failed to add cluster from initializationOptions")
		} else {
			addedCount++
		}
	}

	s.logger.Info().
		Int("count", addedCount).
		Msg("Loaded clusters from initializationOptions")

	return nil
}

// handleListTools handles the tools/list request
func (s *Server) handleListTools(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	toolList := s.registry.ListTools()

	// Convert tools.Tool to mcp.Tool
	mcpTools := make([]Tool, len(toolList))
	for i, t := range toolList {
		mcpTools[i] = Tool{
			Name:        t.Name,
			Description: t.Description,
			InputSchema: t.InputSchema,
		}
	}

	result := ListToolsResult{
		Tools: mcpTools,
	}

	resp, err := NewJSONRPCResponse(req.ID, result)
	if err != nil {
		return NewJSONRPCError(
			req.ID,
			ErrCodeInternalError,
			"Failed to list tools",
			err.Error(),
		)
	}

	return resp
}

// handleCallTool handles the tools/call request
func (s *Server) handleCallTool(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	var callReq CallToolRequest
	if err := json.Unmarshal(req.Params, &callReq); err != nil {
		return NewJSONRPCError(
			req.ID,
			ErrCodeInvalidParams,
			"Invalid tool call parameters",
			err.Error(),
		)
	}

	s.logger.Debug().
		Str("tool", callReq.Name).
		Msg("Calling tool")

	// Execute the tool
	toolResult, err := s.registry.ExecuteTool(ctx, callReq.Name, callReq.Arguments)
	if err != nil {
		s.logger.Error().
			Err(err).
			Str("tool", callReq.Name).
			Msg("Tool execution failed")

		// Return error as tool result (not JSON-RPC error)
		mcpResult := CallToolResult{
			Content: []Content{
				ErrorContent(err.Error()),
			},
			IsError: true,
		}

		resp, _ := NewJSONRPCResponse(req.ID, mcpResult)
		return resp
	}

	// Convert tools.CallToolResult to mcp.CallToolResult
	mcpContents := make([]Content, len(toolResult.Content))
	for i, c := range toolResult.Content {
		mcpContents[i] = Content{
			Type:     c.Type,
			Text:     c.Text,
			Data:     c.Data,
			MimeType: c.MimeType,
		}
	}

	mcpResult := CallToolResult{
		Content: mcpContents,
		IsError: toolResult.IsError,
	}

	resp, err := NewJSONRPCResponse(req.ID, mcpResult)
	if err != nil {
		return NewJSONRPCError(
			req.ID,
			ErrCodeInternalError,
			"Failed to create tool response",
			err.Error(),
		)
	}

	return resp
}

// handlePing handles ping requests
func (s *Server) handlePing(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	resp, _ := NewJSONRPCResponse(req.ID, map[string]string{"status": "ok"})
	return resp
}
