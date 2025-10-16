package mcp

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/ebarron/ONTAP-MCP/pkg/tools"
	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

// Server implements the MCP protocol server
type Server struct {
	registry *tools.Registry
	logger   *util.Logger
	version  string
}

// NewServer creates a new MCP server
func NewServer(registry *tools.Registry, logger *util.Logger) *Server {
	return &Server{
		registry: registry,
		logger:   logger,
		version:  "2025-06-18", // MCP protocol version
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
		Msg("Client initializing")

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
