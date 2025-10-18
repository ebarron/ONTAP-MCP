package tools

import (
	"context"
	"fmt"
	"sync"

	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

// Tool represents an MCP tool definition
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// Content represents a content item in MCP responses
type Content struct {
	Type        string                 `json:"type"`
	Text        string                 `json:"text,omitempty"`
	Data        string                 `json:"data,omitempty"`
	MimeType    string                 `json:"mimeType,omitempty"`
	Annotations map[string]interface{} `json:"annotations,omitempty"`
}

// CallToolResult is the response from calling a tool
type CallToolResult struct {
	Content []Content `json:"content"`
	IsError bool      `json:"isError,omitempty"`
}

// ToolHandler is a function that handles tool execution
type ToolHandler func(ctx context.Context, args map[string]interface{}) (*CallToolResult, error)

// ToolDefinition represents a tool with its handler
type ToolDefinition struct {
	Tool    Tool
	Handler ToolHandler
}

// Registry manages MCP tools
type Registry struct {
	tools  map[string]*ToolDefinition
	mu     sync.RWMutex
	logger *util.Logger
}

// NewRegistry creates a new tool registry
func NewRegistry(logger *util.Logger) *Registry {
	return &Registry{
		tools:  make(map[string]*ToolDefinition),
		logger: logger,
	}
}

// Register registers a new tool
func (r *Registry) Register(name string, description string, inputSchema map[string]interface{}, handler ToolHandler) {
	r.mu.Lock()
	defer r.mu.Unlock()

	tool := Tool{
		Name:        name,
		Description: description,
		InputSchema: inputSchema,
	}

	r.tools[name] = &ToolDefinition{
		Tool:    tool,
		Handler: handler,
	}

	// Debug: Log schema details
	if name == "cluster_list_qos_policies" {
		r.logger.Info().
			Str("tool", name).
			Interface("inputSchema", inputSchema).
			Msg("Registered tool with schema")
	} else {
		r.logger.Debug().
			Str("tool", name).
			Msg("Tool registered")
	}
}

// ListTools returns all registered tools
func (r *Registry) ListTools() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	tools := make([]Tool, 0, len(r.tools))
	for _, def := range r.tools {
		tools = append(tools, def.Tool)
	}

	return tools
}

// ExecuteTool executes a tool by name
func (r *Registry) ExecuteTool(ctx context.Context, name string, args map[string]interface{}) (*CallToolResult, error) {
	r.mu.RLock()
	def, ok := r.tools[name]
	r.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("tool not found: %s", name)
	}

	r.logger.Info().
		Str("tool", name).
		Msg("Executing tool")

	return def.Handler(ctx, args)
}

// Count returns the number of registered tools
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.tools)
}
