package mcp

import (
	"encoding/json"
	"fmt"
)

// JSON-RPC 2.0 specification types

// JSONRPCVersion is the JSON-RPC protocol version
const JSONRPCVersion = "2.0"

// JSONRPCRequest represents a JSON-RPC 2.0 request
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response
type JSONRPCResponse struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      interface{}      `json:"id,omitempty"`
	Result  *json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError    `json:"error,omitempty"`
}

// JSONRPCError represents a JSON-RPC 2.0 error
type JSONRPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Standard JSON-RPC error codes
const (
	ErrCodeParseError     = -32700
	ErrCodeInvalidRequest = -32600
	ErrCodeMethodNotFound = -32601
	ErrCodeInvalidParams  = -32602
	ErrCodeInternalError  = -32603
)

// MCP Protocol types (aligned with spec 2025-06-18)

// InitializeRequest is the MCP initialize request
type InitializeRequest struct {
	ProtocolVersion       string                 `json:"protocolVersion"`
	Capabilities          ClientCapabilities     `json:"capabilities"`
	ClientInfo            Implementation         `json:"clientInfo"`
	InitializationOptions map[string]interface{} `json:"initializationOptions,omitempty"`
	Meta                  map[string]interface{} `json:"_meta,omitempty"`
}

// InitializeResult is the MCP initialize response
type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      Implementation     `json:"serverInfo"`
	Instructions    string             `json:"instructions,omitempty"`
}

// Implementation describes client or server implementation
type Implementation struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// ClientCapabilities describes what the client supports
type ClientCapabilities struct {
	Roots    *RootsCapability    `json:"roots,omitempty"`
	Sampling *SamplingCapability `json:"sampling,omitempty"`
}

// ServerCapabilities describes what the server supports
type ServerCapabilities struct {
	Tools     *ToolsCapability     `json:"tools,omitempty"`
	Resources *ResourcesCapability `json:"resources,omitempty"`
	Prompts   *PromptsCapability   `json:"prompts,omitempty"`
	Logging   *LoggingCapability   `json:"logging,omitempty"`
}

// RootsCapability indicates roots support
type RootsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// SamplingCapability indicates sampling support
type SamplingCapability struct{}

// ToolsCapability indicates tools support
type ToolsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// ResourcesCapability indicates resources support
type ResourcesCapability struct {
	Subscribe   bool `json:"subscribe,omitempty"`
	ListChanged bool `json:"listChanged,omitempty"`
}

// PromptsCapability indicates prompts support
type PromptsCapability struct {
	ListChanged bool `json:"listChanged,omitempty"`
}

// LoggingCapability indicates logging support
type LoggingCapability struct{}

// ListToolsResult is the response to tools/list
type ListToolsResult struct {
	Tools []Tool `json:"tools"`
}

// Tool represents an MCP tool definition
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// CallToolRequest is the request to call a tool
type CallToolRequest struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments,omitempty"`
}

// CallToolResult is the response from calling a tool
type CallToolResult struct {
	Content []Content `json:"content"`
	IsError bool      `json:"isError,omitempty"`
}

// Content represents a content item in MCP responses
type Content struct {
	Type        string                 `json:"type"`
	Text        string                 `json:"text,omitempty"`
	Data        string                 `json:"data,omitempty"`
	MimeType    string                 `json:"mimeType,omitempty"`
	Annotations map[string]interface{} `json:"annotations,omitempty"`
}

// Helper functions

// NewJSONRPCRequest creates a new JSON-RPC request
func NewJSONRPCRequest(id interface{}, method string, params interface{}) (*JSONRPCRequest, error) {
	var paramsBytes json.RawMessage
	if params != nil {
		b, err := json.Marshal(params)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal params: %w", err)
		}
		paramsBytes = b
	}

	return &JSONRPCRequest{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Method:  method,
		Params:  paramsBytes,
	}, nil
}

// NewJSONRPCResponse creates a successful JSON-RPC response
func NewJSONRPCResponse(id interface{}, result interface{}) (*JSONRPCResponse, error) {
	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	raw := json.RawMessage(resultBytes)
	return &JSONRPCResponse{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Result:  &raw,
	}, nil
}

// NewJSONRPCError creates an error JSON-RPC response
func NewJSONRPCError(id interface{}, code int, message string, data interface{}) *JSONRPCResponse {
	return &JSONRPCResponse{
		JSONRPC: JSONRPCVersion,
		ID:      id,
		Error: &JSONRPCError{
			Code:    code,
			Message: message,
			Data:    data,
		},
	}
}

// TextContent creates a text content item
func TextContent(text string) Content {
	return Content{
		Type: "text",
		Text: text,
	}
}

// ErrorContent creates an error text content item
func ErrorContent(errMsg string) Content {
	return Content{
		Type: "text",
		Text: fmt.Sprintf("Error: %s", errMsg),
	}
}
